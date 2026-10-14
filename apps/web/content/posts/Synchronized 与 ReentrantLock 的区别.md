---
title: "Synchronized 与 ReentrantLock 的区别"
date: 2025-01-23 21:28:00
updated: 2026-04-07 22:26:02
categories:
  - "Java"
tags:
  - "Java"
  - "锁"
  - "并发"
---

# Synchronized 与 ReentrantLock 的区别

`synchronized`：**隐式锁**，JVM 自动加锁 / 释放锁

`ReentrantLock`：**显式锁**，需要手动 `lock()` / `unlock()`

ReentrantLock 本质上是基于 AQS 实现的。

synchronized是非公平锁 然后ReentrantLock 有公平锁有非公平锁

ReentrantLock 支持中断`lock.lockInterruptibly();`还有超时获取锁

```java
if (lock.tryLock(1, TimeUnit.SECONDS)) {
    try { } finally { lock.unlock(); }
}
```

|  | synchronized | ReentrantLock |
| --- | --- | --- |
| 锁类型 | 隐式锁 | 显式锁 |
| 释放方式 | 自动 | 手动 |
| 公平锁 | 不支持 | 支持 |
| 可中断 | 不支持 | 支持 |
| 超时获取 | 不支持 | 支持 |
| 底层 | JVM | AQS |

### ReentrantLock的使用场景

一般场景我优先使用 synchronized，代码简单且 JVM 已做了大量优化；当需要超时获取锁、可中断、公平性或多个条件队列时，我会使用 ReentrantLock，它提供了更灵活、更可控的并发能力。
