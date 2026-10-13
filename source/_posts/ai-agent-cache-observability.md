---
title: Ai Agent概念扫盲：Cache Hit、KV Cache、Prompt Cache 与性能
date: 2026-10-12 21:33:00
categories:
  - AI
tags:
  - Agent
  - 概念扫盲
  - Cache
  - Observability
  - 性能
description: 区分八类缓存，解释命中与上下文的关系，再用 Logs、Metrics、Trace 和延迟指标找出时间花在哪里。
---

[返回总览](/2026/10/12/ai-agent-concepts/) · 上一篇 [协作与电脑操作](/2026/10/12/ai-agent-collaboration-computer-use/)。

Agent 面板显示「缓存命中」，你却还是等了很久。

这不一定是缓存没用。命中的可能只是工具目录，而耗时主要发生在模型输出或外部查询。要理解性能，先弄清复用了什么，再看整条任务链的时间。

<!-- more -->

## Cache Hit，找到了满足复用条件的缓存

**Cache 是为复用与性能保存的计算状态或结果。Cache Hit 是命中，Cache Miss 是未找到可用缓存。**

「有缓存」还不够，至少需要说明缓存对象。

| 类型 | 缓存什么 | 简单例子 |
| --- | --- | --- |
| KV Cache | 注意力计算中的 Key、Value 状态 | 生成后续 Token 时复用已有计算 |
| Prompt Cache | 可复用输入前缀的处理结果或计算状态 | 稳定指令和长文档前缀 |
| Response Cache | 完整回答 | 直接复用相同问题的旧答案 |
| Tool Result Cache | 工具执行结果 | 复用一次文档读取 |
| Embedding Cache | 已计算向量 | 相同文本不重复编码 |
| Retrieval Cache | 查询与检索结果 | 复用某版本知识库的候选 |
| Semantic Cache | 对语义近似请求复用结果 | 类似问题匹配已有答案 |
| Tool Catalog Cache | 工具名称、描述、Schema 等目录 | 不重新获取工具列表 |

这些缓存可以同时存在，但命中其中一种不证明其他环节也命中。

## KV Cache，不是用户记忆数据库

**KV Cache 保存的是注意力计算中的 Key 和 Value 表示。** 自回归模型生成后续 Token 时，可以复用先前 Token 的部分计算。

这里的 Key、Value 是模型计算里的表示，不是「用户名 → 用户偏好」那种键值存储。KV Cache 也不能直接替代长期记忆。

具体原理可以看 [Hugging Face 的缓存说明](https://huggingface.co/docs/transformers/cache_explanation)。缓存状态需要资源，长度与模型结构等也会影响内存需求，不能把计算复用理解为完全没有开销。

## Prompt Cache，重复计算减少，信息还在

**Prompt Cache 通常复用符合条件的稳定输入前缀。** 具体条件、最小长度、有效时间、计费和统计依提供方定义，不能跨产品直接套用。

假设有 8,000 Token 稳定前缀，本次追加 2,000 Token，前缀满足复用条件。这是解释概念的例子。

![缓存复用 8,000 Token 前缀计算，逻辑输入仍约 10,000 Token，输出重新生成](/images/ai-agent-concepts/prompt-cache.svg)

模型本次逻辑输入仍约有 10,000 Token。复用的是计算，并没有把前缀内容从上下文容量中删除；模型通常还要生成新输出，也可能继续调用工具。

如果缓存直接返回完整旧答案，那是 Response Cache 的场景。[Claude 的 Prompt caching 文档](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)说明了其具体规则，本篇不把这些规则推广成通用保证。

## Key、TTL、Eviction、Invalidation

**Cache Key** 决定用什么标识查找缓存；**TTL** 是有效时间；**Eviction** 因容量或策略移除缓存；**Invalidation** 因资料、权限或版本变化让缓存失效。

例如报销制度更新，旧检索结果虽然还在 TTL 内，也可能已经不该复用。用户失去访问权限后，缓存不能继续把旧资料返回给他。

缓存键可能需要纳入用户或租户、数据版本、模型版本、查询条件等信息，具体取决于缓存对象。敏感结果跨用户复用前，更要明确作用域。

**Hit Rate** 是命中比例，但统计口径必须说明。按请求计，按 Token 计，只统计可缓存请求，得到的百分比都可能不同。

工具目录命中，只说明复用目录信息，不证明服务仍可达、Schema 仍最新或权限仍有效。

## Semantic Cache，相似请求要考虑业务差异

「今年北京住宿标准」和「去年北京住宿标准」语义很像，答案却可能不同。「我的余额」不能因为文字相同就跨用户复用。

语义缓存要判断哪些差异允许复用，哪些条件必须严格匹配。相似度阈值也不能直接当答案正确概率。

动态工具定义可能改变输入前缀，但影响依具体接口设计而定。不能只凭「增加了工具」就断言一定完全破坏缓存，也不能认为目录缓存能保证模型前缀命中。

## Observability，知道哪里发生了什么

**Observability，可观测性**，帮助解释系统运行情况。常用信号包括 Logs、Metrics 和 Traces。

| 信号 | 作用 | 示例 |
| --- | --- | --- |
| Logs | 离散事件记录 | 重排失败、工具超时 |
| Metrics | 数量与分布 | 成功率、队列长度、耗时分位数 |
| Trace | 关联一次过程的多个操作 | 一次任务经过模型、检索和工具 |
| Span | 一个操作的起止、状态和属性 | 某次检索用了多少时间 |
| Event | 某一时刻的变化 | 用户取消、工具完成 |
| Correlation ID | 关联分散记录 | 客户端请求与后台 Run 对应 |

Trace 可以跨进程，Span 可以嵌套；详细定义见 [OpenTelemetry 的信号说明](https://opentelemetry.io/docs/concepts/signals/)。

日志帮助解释故障，检查点和恢复机制才帮助继续执行。只有详细日志，不会自动获得可靠恢复能力。

## Latency、TTFT、TPOT，起点终点要说清

**Latency** 是从指定起点到终点的延迟。**TTFT** 是首 Token 延迟；**TPOT** 是生成阶段平均每个 Token 的时间，具体采样和统计口径需要说明；**End-to-end Latency** 是任务从提交到完成的总时间。

首字一秒出现，但后面还要查十个外部服务，任务仍可能很慢。

**Throughput** 是单位时间处理的请求、Token 或任务数量；**Concurrency** 是同一时间范围内处理中的任务数量。吞吐增加不保证每个请求的延迟下降。

**p50、p95、p99** 是延迟分位数。p95 为 10 秒，通常表示约 95% 的观测值不超过该时间，需要同时说明统计窗口和样本范围。

**RPM** 是每分钟请求数，**TPM** 是每分钟 Token 数，常用于服务限额或速率描述。

## 时间还可能花在哪里

排队、读取文件、模型处理输入、输出生成、工具网络、数据库写入、外部任务等待和界面渲染，都可能计入用户等待。

**CPU / GPU** 是计算资源；**RAM / VRAM** 是主内存和显存；**I/O** 是文件、网络、数据库等输入输出。

**Cold Start** 是首次启动或重新准备环境的开销；**Warm Pool** 保留预热资源；**Connection Pool** 复用连接；**Worker Pool** 复用执行单元。

**Batching** 合并多项工作；**Continuous Batching** 在模型服务中动态安排生成请求；**Speculative Decoding** 通过草稿候选与目标模型验证等方式减少部分生成开销。这些属于服务与推理技术，不等于增加多个 Agent，收益也需要实测。

## Rate Limiting、Quota 和运行保护

**Rate Limiting** 限制调用速率；**Quota** 限制总用量或资源；**Backpressure** 在下游来不及时限制上游；**Circuit Breaker** 在依赖连续异常时暂时阻止继续请求。

**Fallback** 切换替代方案；**Degradation** 接受部分功能或质量降低；**Model Routing** 按任务选择模型；**Cascade** 先走一条路径，再按条件升级。

比如便宜模型先分类，无法可靠判断时升级到更强模型，是一种 Cascade。但错误的分类可能使请求根本没有升级，最终效果要看任务成功率、质量和总成本。

## 优化之前，先建立可比较的记录

「少了工具定义字符」可以证明输入规模减少；「缓存命中」可以证明某些计算复用；「首字更快」可以证明对应指标改善。要证明整个任务更快，需要看端到端耗时和成功率。

同样一批任务、相近环境，记录模型调用、工具耗时、缓存口径与结果，再决定优化哪一层。若工具等待占了大部分时间，单独调整提示词未必能带来明显收益。

[下一篇：权限、测试与评测](/2026/10/12/ai-agent-safety-evaluation/) · [返回总览](/2026/10/12/ai-agent-concepts/)
