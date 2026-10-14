---
title: "MySQL 联合索引的最左匹配原则"
date: 2025-11-22 01:25:00
updated: 2026-04-07 22:26:02
categories:
  - "数据库"
tags:
  - "MySQL"
  - "索引"
---

# MySQL 联合索引的最左匹配原则

**执行计划基础知识**

**possible\_keys**：可能用到的索引

**key**：实际用到的索引

**type**:

1. ref：当通过普通的二级索引列与常量进行等值匹配的方式 询某个表时
2. const：当我们根据主键或者唯一得二级索引列与常数进行等值匹配时，对单表的访问方法就是 const
3. range:如果使用索引获取某些单点扫描区间的记录。
4. index：当可以使用覆盖 ，但需要扫描全部的索引记录时。

**Extra**:

1. Using index 索引覆盖
2. Using Where 当某个搜索条件需要在 server 层进行判断时
3. Using index for skip scan 跳跃扫描
4. Using index condtion 索引下推

## 最左匹配原则

最左优先，以最左边的为起点任何连续的索引都能匹配上。同时遇到范围查询(>、<、between、like)就会停止匹配。

比如有联合索引 [a、b、c]，where 过滤条件中哪些排列组合可以用到索引？（比如这种：where a=xxx b=xxx and c=xxx）

以下排列组合都会走索引： a、ab、ac、ba、ca、abc、acb、bac、bca、cab、cba。 必须有一个 a，排列组合中的顺序会被优化器优化，所以不用关心顺序。

以下排列组合不会走索引： b、c、bc、cb。 因为没有 a。

关于范围查询： a=xxx and b<10 and b > 5 and c =xxx，c 字段用不到索引，因为 b 是一个范围查询，遇到范围查询就停止了。

by -<https://juejin.cn/post/7283832557502693413>
