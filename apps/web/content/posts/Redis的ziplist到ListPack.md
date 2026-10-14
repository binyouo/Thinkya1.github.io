---
title: "Redis的ziplist到ListPack"
date: 2025-12-21 22:24:00
updated: 2026-04-07 22:26:02
categories:
  - "数据库"
tags:
  - "Redis"
  - "数据结构"
---

## Redis的压缩列表ziplist到紧凑列表listpack

### ziplist 的结构（老版本用的）

大概长这样：

```
[zlbytes][zltail][zllen][entry1][entry2]...[entryN][0xFF]
● *zlbytes*，记录整个压缩列表占用对内存字节数；
● *zltail*，记录压缩列表「尾部」节点距离起始地址由多少字节，也就是列表尾的偏移量；
● *zllen*，记录压缩列表包含的节点数量；
● *0xFF*，标记压缩列表的结束点，固定值 0xFF（十进制255）。
```

每个 `entry` 里：

```
[prevlen][encoding][data]
```

- `prevlen`：前一个 entry 的长度（1 或 5 字节）
- `encoding`：当前 entry 是字符串还是整数，长度是多少
- `data`：真正的数据

### listpack 的结构（新版本用的）

大概长这样：

```
[total_bytes][count][entry1][entry2]...[entryN][0xFF]
total_bytes：整个 listpack 的总字节数
count：entry 的个数（元素数量）
● *0xFF*，标记压缩列表的结束点，固定值 0xFF（十进制255）。
```

每个 `entry` 里：

```
[encoding+len][data][backlen]
[encoding+len]：
1.数据类型（string/int…）
2.字符串长度（完整长度信息）
3.如果长度太长，encoding 会表示“后面几个字节继续存长度”
backlen ：当前整个 entry 的总字节数
```

注意两点变化：

1. **没有 prevlen 了**（不再依赖“记录前一个元素长度”来反向遍历）
2. 多了 **backlen**（记录自己的完整长度，用来从后往前遍历）

这是 ziplist 被吐槽最多的一个点：**级联更新（cascading update）**。

## 1.ziplist 的问题

- 每个 entry 前面有个 `prevlen` 字段，记录 *前一个 entry 的长度*
- `prevlen` 自身可能是 **1 字节** 或 **5 字节**
  - 如果前一个 entry 变大了，从 253 → 300 字节
  - 起初 `prevlen` = 1 字节，现在需要 5 字节
- 那么：
  - 当前 entry 要扩展 4 字节
  - 它变长后，下一个 entry 的 `prevlen` 又可能从 1 → 5
  - 如此继续……导致**后面一串 entry 都要重写、搬移内存**

结果就是：**某个元素变长，可能触发 O(N) 的连锁内存搬移**，列表越大越惨，而且实现特别绕，也容易出 bug。

## 2.listpack 如何改进？

- listpack 不再在每个元素开头放 `prevlen`
- 改为在 **元素末尾** 放一个 `backlen`，记录**这个元素自己的长度**
- 反向遍历时：
  - 从尾开始，先读 backlen → 退回去这么多字节 → 得到前一个元素起始位置

这样改的一个好处是：

- 你修改某个元素的长度时，只需要考虑它**自己的 backlen**
- 不会像 ziplist 那样，影响后面每一个元素的 `prevlen` 字段

虽然单个元素变长还是需要移动后面的内存，但**不会再产生那种“级联字段变化”的连环改动**，整体逻辑简单且更可控。

---

## 3. 存储编码更紧凑，节省内存

listpack 是在 ziplist 的经验基础上重新设计的，目标就是：

> **“既要省内存，又要减少复杂边界情况”**

主要变化：

1. **编码种类更合理**
   - 对整数、短字符串等使用多种变长编码方案
   - 比 ziplist 更灵活、更紧凑
2. **去掉多余的头部字段**
   - ziplist 有 `zltail` 等字段
   - listpack 头部只保留对操作真正有用的字段（总字节数、元素数），结构更轻量
3. **统一整数/字符串编码格式**
   - 在不同模块（hash、zset、list）里都可以复用 listpack
   - 更利于代码维护和优化

总体效果：**在很多实际场景中，listpack 比 ziplist 更省内存，尤其是大量小元素时**。

---

## 4. 性能与安全性方面的改进

### ① 性能

- 减少了级联更新的问题，尤其是**修改中间元素时**更稳定
- 更简单的编码与解析逻辑，有利于编译器优化、CPU cache 命中

### ② 安全性

ziplist 曾经出过多次 **整数溢出 / 越界** 的安全漏洞（CVE），原因之一就是：

- 设计偏复杂，各种长度字段 + 级联更新
- 很难做到所有边界都不出错

listpack 从设计上就尽量：

- 简化字段
- 减少依赖“前一个元素长度”的逻辑
- 更好地检查长度合法性
