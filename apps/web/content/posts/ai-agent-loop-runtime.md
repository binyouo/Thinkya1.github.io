---
title: Ai Agent概念扫盲：Agent Loop、ReAct、Runtime 与 Harness
date: 2026-10-12 21:37:00
categories:
  - AI
tags:
  - Agent
  - 概念扫盲
  - ReAct
  - Runtime
  - Harness
description: Agent 怎样根据反馈行动，任务状态存在哪里，断连和恢复有什么区别，以及为什么超时后不能盲目重试。
---

[返回总览](/2026/10/12/ai-agent-concepts/) · 上一篇 [工具与协议](/2026/10/12/ai-agent-tools-protocols/)。

用户让 Agent 修一个 Bug。它读日志、改代码、跑测试，失败后又继续改。这种过程看起来像模型一直在工作，实际上外围程序在不断组织调用、执行工具和更新状态。

这一篇沿着任务的推进与中断，把「循环」「运行」「恢复」放在一起解释。

<!-- more -->

## Chatbot、Script、Workflow、Agent

**Chatbot** 侧重输入与答复；**Script** 按程序逻辑执行；**Workflow** 预先安排步骤与分支；**Agent** 根据任务和反馈动态选择行动。

「读取文档 → 提取字段 → 校验 → 入库」可以是工作流。校验节点也能使用模型，但整体路径依然预先规定。

「排查登录失败」则可能先读代码，也可能先看日志，拿到新证据后再决定。**Agentic** 常用来描述这种参与决策和行动的特征，自主范围可以很小。

这是一种实用划分，实际系统经常混合使用。参考 [Anthropic 的工作流与 Agent 讨论](https://www.anthropic.com/engineering/building-effective-agents)。

## Agent Loop，怎样转下一轮

**Agent Loop 是围绕模型、行动和观察反复执行的控制过程。**

```text
准备上下文 → 调模型 → 检查输出
                      ↓ 请求行动
                 校验并执行工具
                      ↓
                保存结果与更新状态
                      ↓
                  继续下一轮
```

**Policy** 在这里指选择行动的机制；安全领域的 Policy 又常指约束规则，要看语境。**Action** 是行动；**Observation** 是得到的观察；**Environment** 是能观察或影响的环境；**Trajectory** 是行动和观察形成的轨迹。

**Step** 是一步，但没有统一边界。有的实现算一次模型调用，有的算工具动作，有的算状态图节点。看到 `maxSteps = 10`，需要继续看它限制哪一种。

结束也有多种原因，完成、失败、取消、预算耗尽，或等待用户。不能把所有「停止」都展示成「任务完成」。

## ReAct，观察真的能改变下一步

**ReAct 来自 Reasoning 和 Acting，强调推理与行动交替推进。** [原始论文](https://arxiv.org/abs/2210.03629)研究了二者结合的方式。

排查登录失败时，Agent 原先怀疑网络，读取日志后发现是数据库权限，再去检查连接配置。这次观察改变了原来的方向。

ReAct 不要求把完整内部思考展示给用户。用户更需要知道采取了哪些行动，得到什么证据，结论怎样形成。

前端开发中的 **React** 是 UI 库，与这里的 **ReAct** 分开理解。

## CoT、Reflection、Self-consistency、ToT

**CoT，Chain of Thought，思维链**，关注多步推理过程。**Reflection** 让模型评价自己的产出或行动。**Self-consistency** 采样多条推理路径，再利用最终答案的一致性选择结果。**Tree of Thoughts，ToT**，显式探索并评估多个候选思路。

这些研究方法都有具体机制，不是给提示词加一句「认真想想」就完整实现了。可以继续读 [CoT](https://arxiv.org/abs/2201.11903)、[Self-consistency](https://arxiv.org/abs/2203.11171) 和 [ToT](https://arxiv.org/abs/2305.10601) 原始论文。

还有一个边界，模型自我评价不能代替独立验证。「这段代码应该正确」是一种判断；测试真正通过、目标业务行为真正出现，是另一种证据。

**Planner** 拆计划，**Executor** 执行，**Replanner** 根据新证据修订，**Critic** 提出问题，**Verifier** 检查验收条件。这些角色可以由一个模型在不同阶段承担，也可以由不同组件承担，不必都做成独立 Agent。

## Engineering Loop 和 Event Loop

**Engineering Loop，工程闭环**，从要求出发，实施变更，取得真实反馈，根据反馈修正，再交付。

修登录 Bug 时，验收条件可以是「正确凭据能登录，错误凭据被拒绝，既有登录方式仍正常」。只改代码没有检查，反馈就不完整。

**Event Loop，事件循环**，是运行时调度异步事件和回调的机制，例如 [Node.js 的事件循环](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)。`for`、`while` 是语言中的循环控制结构。

Agent Loop 控制任务，Event Loop 调度异步程序，Engineering Loop 用证据修正实现。一个程序可以同时包含它们。

## Runtime、Harness、Framework、SDK

**Runtime** 有几个常见含义。语言 Runtime 是 Node.js、Python 等运行环境；Agent Runtime 承载循环、工具执行、状态和生命周期；与 Build-time 对比时，Runtime 指运行期间。

**Harness** 是围绕模型建立的执行与反馈机制，可能包含指令、接口、上下文处理、权限、调度、恢复和退出条件。与 Runtime 的范围有重叠，不应把本篇分组当成强制架构标准。[长任务 Harness 的官方案例](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)讨论了跨上下文窗口保持进展的问题。

**Harness Engineering** 就是在设计这些外围机制。例如日志太长怎样分页、工具失败怎样反馈、中断后怎样继续、完成怎样判定。

**Framework** 提供组织应用的方式和可复用组件；**SDK** 提供接口封装、类型与辅助代码。SDK 可能只封装模型请求，也可能包含 Agent Loop；是否支持权限、持久化和恢复，应分别确认。

| 工程方向 | 主要调整什么 |
| --- | --- |
| Prompt Engineering | 任务指令、示例、约束和输出要求 |
| Context Engineering | 每次调用看到哪些信息 |
| Tool / Interface Engineering | 工具参数、结果和错误表达 |
| Harness Engineering | 执行、状态、权限、恢复和完成判定 |
| Agent Engineering | 模型、工具、信息、执行和产品的整体配合 |
| Evaluation Engineering | 任务集、判分方法和证据 |
| LLMOps / AgentOps | 部署、监控、版本、成本和故障管理 |

## Session、Run、Process 不是一个对象

**Conversation** 是对话记录；**Session** 是带标识的交互或执行上下文；**Turn** 是一轮交互，边界依系统定义；**Run** 是一次运行实例；**Task** 是有目标和范围的工作；**Attempt / Trial** 是一次尝试。

**Process** 是操作系统进程。**Thread** 既可能指操作系统线程，也可能指产品里的对话线程。

一个进程可以服务多个 Session，一个 Run 可以启动多个工具进程。界面关了以后任务是否继续，取决于后端生命周期，不取决于界面还保不保留聊天记录。

**Worker** 是执行单元，**Queue** 存放待执行任务，**Scheduler** 决定何时交给谁，**Daemon** 是后台常驻进程。**IPC** 是进程间通信，**PTY** 是支持终端交互的伪终端。

**Concurrency，并发**，多项工作在同一时间范围内推进；**Parallelism，并行**，强调真正同时执行。界面里出现三个任务，不能单独证明它们正在并行调用模型。

## State 和 Source of Truth

**State 是现在处于什么阶段。Source of Truth 是判断某类事实时应以哪份记录为准。**

任务可以处于排队、运行、等待输入、完成、失败或取消。文件是否修改，以工作区内容为准；工单是否创建，以工单系统为准。聊天里一句「已经创建」不能覆盖外部系统事实。

**Persistence，持久化**，让进程退出后数据仍可读取。**Checkpoint，检查点**，保存从某个边界恢复所需的状态。**Snapshot，快照**，保存某时刻某范围的状态。

**Event Log** 按序记录事件；**Event Sourcing** 以领域事件序列作为状态变化的权威记录。保存一些运行日志，不自动等于采用了 Event Sourcing。

**Replay** 根据事件或已记录结果重建执行；**Resume** 从可恢复边界继续；**Reconnect** 恢复通信连接；**Durable Execution** 通过持久化、调度和恢复机制跨故障继续工作。

保存聊天历史不等于保存工具进度，检查点也不能保证从任意一行代码继续。[LangGraph 的持久执行文档](https://docs.langchain.com/oss/python/langgraph/durable-execution)说明了恢复边界和副作用处理的重要性。

## 超时后为什么不能直接再来一次

**Timeout** 说明在限定时间内没有收到完成结果。它不能证明外部操作没有成功。

比如 Agent 请求创建工单，服务端创建成功，响应途中断线。直接再创建，就可能得到两张工单。

**Retry** 是重试；**Backoff** 在重试间增加等待；**Jitter** 为等待加入随机变化，避免大量请求同时重试。**Cancellation** 请求停止，已经发生的外部效果不一定能撤销。

**Partial Success** 表示一组操作只有部分成功；**Compensation** 用新的动作抵消已有部分效果，比如取消一条已经创建的预约，补偿本身也可能失败。

## Idempotency 和 Reconciliation

**Idempotency，幂等性**，指在约定范围内重复同一请求，其预期业务效果与执行一次相同。它不要求每次返回文本完全一样，附带日志也可能增加。[HTTP 规范的幂等性定义](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)可以作为一个基础例子。

**Idempotency Key** 帮助服务识别重复请求。需要明确键的作用域、有效期、参数冲突和并发规则。

**Reconciliation** 是状态核对。响应丢失后，先用业务标识查询工单是否已存在，再决定继续或重试。

| 交付语义 | 在约定范围内的含义 |
| --- | --- |
| At-most-once | 至多一次，可能没有发生 |
| At-least-once | 在约定故障假设下至少一次，可能重复 |
| Exactly-once | 恰好一次，必须说明覆盖哪些系统和边界 |

只有重试循环，不能自动得到 At-least-once 保证；本地数据库事务，也不能自动回滚已经发出的外部操作。

**Lock** 互斥访问，**Lease** 在有效时间内授予执行权，**Heartbeat** 报告执行者还在活动，**Version / CAS** 通过版本比较检测并发修改，**Transaction** 在限定范围内保证一致性，**Backpressure** 在下游来不及时限制上游。

心跳说明仍有活动，不说明任务一定有进展。

## 看一个 Agent 运行系统，先找四个答案

谁决定下一步，谁执行真实动作，状态存在哪里，怎样证明目标完成。

这四个答案清楚以后，再看 Runtime、Harness、Checkpoint，名词就能对应到具体代码。想继续沿真实实现读，可以看 [Pi Agent Loop](/2026/08/04/Pi%20Agent%20loop/)；里面的 Turn 等边界属于该实现，不能直接当成全行业定义。

[下一篇：上下文、历史和记忆](/2026/10/12/ai-agent-context-memory/) · [返回总览](/2026/10/12/ai-agent-concepts/)
