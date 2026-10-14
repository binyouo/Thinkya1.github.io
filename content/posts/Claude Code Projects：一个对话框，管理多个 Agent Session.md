---
title: Claude Code Projects：一个对话框，管理多个 Agent Session
date: 2026-10-10 12:00
categories:
  - Agent
  - AI
tags:
  - Claude Code
  - Agent
  - 多 Agent
  - 上下文管理
---

今天看到了 Claude 的一篇文章，介绍重新设计后的 **Claude Code Projects**。

我觉得这个功能挺有意思：它在 Claude Code Session 之上增加了一个项目级 Coordinator（协调 Agent），用统一的项目对话来管理多个独立的 Claude Code Session。

用户只需要在一个对话框里持续提出需求，Coordinator 就可以根据任务情况创建或复用 Thread，完成任务拆分、分发与结果汇总。

## 一、整体架构

Claude Code Projects 的结构可以简单理解为：

**Project → Coordinator → Threads（Sessions）**

- **Project**：项目级工作空间，关联代码仓库或其他上下文，并保存项目指令与共享记忆。
- **Coordinator**：负责理解需求、拆分任务、调度 Thread，并跟踪执行进度。
- **Thread**：独立的 Claude Code 云端 Session，负责具体任务的执行。

例如，用户提出一个需求：

> 分析当前项目的后端架构，优化运行时性能，并补充必要的测试。

Coordinator 可以按任务依赖关系拆分工作：

- Thread A：分析架构和性能瓶颈。
- Thread B：根据分析结果优化代码。
- Thread C：补充测试并验证修改。

每个 Thread 都是完整的 Claude Code Session，而不只是简单的 Subagent。云端 Thread 在独立分支和仓库副本中工作，内部也可以继续使用 Subagent、循环或工作流拆解任务。

Coordinator 可以创建新的 Thread，也可以把后续任务交给已有 Thread 继续执行。多个 Thread 如果改动了同一处代码，仍然需要像处理普通 PR 一样解决冲突。

## 二、我认为最大的价值是统一交互入口

相比多 Agent 并行，我个人更关注它的交互设计。

对于用户来说，理想的交互方式可能就是**一个 Project 对应一个主要对话框**。

用户不需要频繁创建新的 Session，也不必为了完成相关任务，在多个对话之间来回切换、重复描述项目背景。

例如，今天让 Claude 优化 RuntimeHost，明天让它继续修复相关 Bug，后天再补充测试。这些需求都可以直接发送给同一个 Coordinator，由它决定交给哪个 Thread 执行。

这样用户面对的是一个持续存在的项目，而不是一堆分散的聊天记录。

底层的 Session 并没有消失。Coordinator 依然会管理多个 Thread，只不过用户不再需要手动处理它们的生命周期和任务分配。

必要时，用户仍然可以进入具体 Thread，查看代码修改、工具调用以及执行结果。

**统一的是交互入口，而不是所有 Agent 的执行上下文。**

我认为这种设计更符合人的使用习惯。用户应该专注于描述目标和检查结果，而不是花费大量精力组织 Agent 的工作过程。

## 三、那同一个对话框会不会上下文爆炸？

这是我觉得比较值得研究的地方。

虽然用户始终在一个 Project 对话框里交流，但这并不代表所有 Session 的上下文都被塞进同一个模型窗口。

这里至少可以区分两个层次的上下文。

**首先是 Thread Context。**

每个 Thread 有自己的上下文窗口，独立进行代码阅读、工具调用、修改和测试。Coordinator 会接收 Thread 返回的进展和结果，不需要把每个 Thread 的完整执行历史都当作自己的对话内容。

因此，多个 Thread 的上下文不会简单累加到 Coordinator 的上下文窗口中。

**其次是 Coordinator Context。**

Coordinator 本身依然有上下文窗口限制。如果用户持续几个月都在同一个 Project 里对话，消息和任务信息也会不断积累。

Anthropic 公开介绍确认，Project 中的 Thread 会共同写入并读取共享 Memory，帮助后续工作沿用项目细节和决策。官方介绍没有披露 Coordinator 每轮具体加载多少历史消息、采用什么裁剪策略。因此，“结合近期消息、近期 Thread 信息与 Project Memory 来组织上下文”更适合作为一种基于产品描述的理解，而不是已公开确认的实现细节。

即使有共享 Memory，也不代表彻底解决了上下文问题。较早的需求、设计决策或任务约束，如果没有被正确记录下来，仍然可能在后续执行中丢失。

因此，**它解决的主要是上下文的隔离和管理，而不是让模型拥有无限上下文。**

## 四、我的理解

我认为 Claude Code Projects 的核心设计可以概括为：

**Project 负责长期交互与协调，Session 负责具体执行，Memory 负责跨 Session 保留重要信息。**

这几个概念不应该混在一起。

用户看到的是一个统一且持续存在的项目对话框，而底层实际上由多个具有独立生命周期的 Session 组成。

从交互体验来看，它减少了用户管理大量 Session 的负担。

从上下文管理来看，它避免了把所有任务的执行过程集中到同一个模型窗口。

我觉得这是一个挺合理的方向。

尤其对于 Coding Agent 来说，**用户真正需要的可能不是管理 Session 的能力，而是让 Agent 自己管理 Session 的能力。**

当然，Coordinator 如何决定创建或复用 Thread、如何维护跨 Session 的任务状态，以及怎样保证长期共享记忆的准确性，仍然是值得继续研究的问题。

---

**参考资料**

- [Claude：Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)
- [Claude Code Projects 官方文档](https://code.claude.com/docs/en/claude-projects)
