---
title: AIO BIO NIO区别？
date: 2026-07-30 17:32
updated: 2026-04-07 22:26:02
categories:
  - Java
  - 未分类
tags:
  - Java
  - IO
  - 随笔
---

# AIO BIO NIO区别？

### **BIO（同步阻塞 I/O）**

BIO 是传统的 I/O 模式，全称为 **Block I/O**，也叫同步阻塞 I/O。在 BIO 模式下，当我们执行 I/O 操作时，比如读取文件或者网络请求，程序会 **阻塞**，直到 I/O 操作完成后，才能继续执行后面的代码。也就是说，当一个线程在等待 I/O 完成时，它是处于**阻塞状态**的，不能做其他事情。

### **NIO（同步非阻塞 I/O）**

**一个线程管理多个连接**

NIO 是对传统 BIO 的改进，它全称是 **Non-blocking I/O**（非阻塞 I/O）。在 NIO 模式下，I/O 操作不是阻塞的，可以同时处理多个 I/O 请求。与 BIO 不同的是，NIO 使用了 **[Channel](https://zhida.zhihu.com/search?content_id=252965872&content_type=Article&match_order=1&q=Channel&zhida_source=entity)（通道）** 和 **[Buffer](https://zhida.zhihu.com/search?content_id=252965872&content_type=Article&match_order=1&q=Buffer&zhida_source=entity)（缓冲区）** 来进行数据读写，并且它支持 **多路复用**，这意味着多个 I/O 操作可以共享一个线程来处理，从而大大提高了并发性能。

### **AIO（异步非阻塞 I/O）**

AIO 是 NIO 的进一步升级，叫做 **Asynchronous I/O**（异步非阻塞 I/O）。在 AIO 模式下，I/O 操作是完全异步的，不需要线程阻塞等待 I/O 完成。AIO 基于事件和回调机制，当 I/O 操作完成时，系统会通知应用程序，程序就能接收到结果。
