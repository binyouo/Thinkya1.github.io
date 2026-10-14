---
title: Pi Agent 上下文工程，模型每一轮到底看到了什么
date: 2026-08-02 12:00:00
categories:
  - Agent
  - AI
  - 架构设计
tags:
  - 上下文工程
  - Compaction
  - Agent
  - 源码阅读
  - ContextEngineering
---
Pi Agent 给人的一个错觉是，它好像记得整个项目。

你让它读文件、跑测试、修改实现，再回头问它为什么这样改，它通常还能接上前面的工作。但打开源码会发现，Pi 并没有给模型一块无限记忆。每次调用模型之前，它都会从会话、工具结果、项目规则和当前输入里，重新裁出一份可以发送的消息。

所以真正值得研究的问题不是模型能记住多少，而是这一轮请求发出之前，Pi 决定让模型看到什么，又把什么留在了上下文之外。

这就是上下文工程。

![Pi Agent 上下文工程的四层防线](/img/covers/pi-agent-context-defense.svg)

上图可以先当作全文地图。工具结果要控制体积，项目规则要按层级注入，过长的线性历史要压缩，会话树切换分支时还要保留旧分支的探索成果。它们共同处理的不是同一个问题，也不应该被塞进一个巨大的 `summarizeHistory` 函数里。

## 一、先把“上下文”拆成两次变换

在 `@earendil-works/pi-agent-core` 中，Agent 内部先处理自己的 `AgentMessage[]`，然后才把它转换成模型 API 能理解的消息。

```text
AgentMessage[]
    ↓ transformContext()
AgentMessage[]
    ↓ convertToLlm()
LLM Message[]
    ↓
模型 API
```

`transformContext` 是一个可选的上下文变换点，可以裁剪消息，也可以在调用模型前注入额外信息。
`convertToLlm` 则负责把 Agent 内部的消息转换成模型协议。

Pi 的 Agent 内部可以保存自定义消息，但模型通常只直接理解 `user`、`assistant` 和 `toolResult` 这类标准消息，因此转换层还要过滤或改写模型不认识的内容。

coding-agent 在这条核心链路之上继续加入系统提示词、工具定义、项目上下文文件、Skills、Session Tree 和工具执行结果。完整一点可以写成这样。

```text
Session Tree + 当前输入 + system prompt + tools
                         ↓
                   AgentMessage[]
                         ↓
                 transformContext()
                         ↓
                   convertToLlm()
                         ↓
                    LLM Message[]
```

这带来一个很重要的判断。

模型每次看到的上下文，不等于 Session 里保存的所有消息，也不等于终端里显示的全部内容。它是一个在请求前生成的投影。后面讲工具截断和 Compaction 时，都应该记住这个边界。

## 二、单次工具结果，先在入口处设上限

上下文变长有两个来源。一个是历史越积越多，另一个是某一次工具调用就返回了过大的结果。


| 限制        |    默认值 | 作用                    |
| --------- | -----: | --------------------- |
| 最大行数      | 2000 行 | 防止输出行数过多              |
| 最大字节数     |   50KB | 防止少量超长行占满窗口           |
| grep 单行长度 | 500 字符 | 防止压缩文件的一行命中吃掉大量 token |

只限制行数不够，因为压缩后的 JavaScript 可能一行就有几十 KB。只限制字节数也不理想，因为源代码应该尽量按完整行保留，直接在任意字节处切开，结果会变得很难读。因此 PI 采用双重限制，行数或字节数任意一个先到，就停止继续保留。

### read 和 bash 为什么从不同方向截断

Pi 并不是所有输出都使用同一种截断策略。

`read` 读取文件时，开头的 import、类型定义和类接口通常更有助于理解文件结构，因此更适合使用 `truncateHead`，保留文件开头。

`bash` 执行命令时，编译错误、测试失败和最终统计往往出现在末尾，因此更适合使用 `truncateTail`，保留末尾一段。

把尾部截断的核心逻辑压缩成伪代码，大概是这样。

```ts
function truncateTail(
  content: string,
  maxLines = 2000,
  maxBytes = 50 * 1024,
) {
  const lines = content.split("\n");
  const kept: string[] = [];
  let bytes = 0;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const lineBytes = byteLength(line) + 1;

    if (kept.length >= maxLines || bytes + lineBytes > maxBytes) {
      break;
    }

    kept.unshift(line);
    bytes += lineBytes;
  }

  return kept.join("\n");
}
```

这里还有几个工程细节。

- UTF-8 字符不能按任意字节切开，中文和 emoji 都要保持完整。
- 一行本身超过 50KB 时，不能因为它太长就返回空结果，需要保留可读的部分并标记为部分截断。
- 截断不能是静默丢弃，结果里应当告诉模型原始输出有多大、当前展示了哪一段，以及完整内容是否落在临时文件中。

关键在于，默认只发送高信号片段，同时给模型一条继续获取完整内容的路径，远比让模型在一开始就吞下整份日志稳妥。

### 两个“2000”不是一回事


`truncate.ts` 里的 2000 是正常工具结果的最大行数。

Compaction 使用 `serializeConversation` 准备摘要请求时，又会把每个 `toolResult` 限制在 2000 个字符左右，并在文本里留下被截断的标记。

前者控制工具结果如何进入普通 Agent Loop，后者控制历史如何进入摘要模型。它们都叫 2000，却处于两条不同的链路上。做上下文预算时，不能只看到一个数字就认为全局已经有了统一限制。

## 三、系统提示词不是一段固定字符串

工具输出截断是在做减法，系统提示词组装则是在做有选择的加法。

Agent 需要知道项目规范，但不应该每轮都把整个项目资料库塞进 system prompt。Pi 的做法是把必须知道的规则自动装进提示词，把可能用到的长资料留给工具按需读取。

### 上下文文件按目录层级合并

`loadProjectContextFiles` 会读取用户级 `agentDir` 下的上下文文件，再从当前工作目录向父目录查找项目规则。`loadContextFileFromDir` 当前识别 `AGENTS.md`、`AGENTS.MD`、`CLAUDE.md` 和 `CLAUDE.MD` 这些文件名变体。

一个典型的目录关系可以写成这样。

```text
/myorg
├── AGENTS.md                         组织级规则
└── teams
    └── team-a
        ├── CLAUDE.md                 团队规则
        └── projects
            └── app-a
                ├── AGENTS.md         项目规则
                └── src/              当前工作目录
```

这样组织之后，上层目录可以放通用约束，项目目录再补充具体规则。源码会把不同层级的内容按通用到具体的顺序整理出来，让靠近当前项目的说明拥有更明确的上下文位置。

在 system prompt 中，它们还会被包在清晰的结构边界里。

```xml
<project_context>
  <project_instructions path="/myorg/AGENTS.md">
    组织级规则
  </project_instructions>

  <project_instructions path="/myorg/teams/team-a/projects/app-a/AGENTS.md">
    项目规则
  </project_instructions>
</project_context>
```

XML 标签在这里承担的是边界标记。模型能看到这段内容来自哪个文件，也能区分项目指令和普通对话。对规则类文本来说，来源和范围都比把几段 Markdown 直接拼起来更重要。

### Skills 只放目录，正文按需加载

Skills 是另一类容易把 system prompt 撑大的内容。一个 Skill 可能包含完整的操作流程，但一次任务通常只会用到其中一部分。

`formatSkillsForPrompt` 放入 system prompt 的主要是下面三项。

| 内容       | 用途                |
| -------- | ----------------- |
| Skill 名称 | 让模型知道有哪些能力        |
| Skill 描述 | 帮模型判断是否匹配当前任务     |
| Skill 路径 | 匹配后通过 `read` 加载全文 |

这是一种目录和正文分离的设计。系统不必提前猜模型会用到哪份长文档，只要先告诉它可用能力和读取位置。任务展开后，模型再把真正需要的内容拉进当前上下文。

但懒加载不是越多越好。每轮都必须遵守的规则应该直接放入 system prompt，否则模型可能根本不会主动读取。只有低频、任务相关、篇幅较长的知识，才适合做成按需加载的 Skill。

## 四、Session Tree 不是聊天列表

到了历史管理阶段，Pi 的一个关键选择会变得很明显。Session 不是一条只能向后追加的聊天列表，而是一棵可以从不同叶子节点继续工作的会话树。

```text
SessionHeader
├── type: "message"         user / assistant / toolResult
├── type: "compaction"
└── type: "branch_summary"
```

当前请求的上下文，通常由根节点到当前叶子的路径构建出来。用户从旧节点分叉时，路径就会改变。Compaction 和 Branch Summary 也不是只存在于内存里的两段 prompt 文本，而是会作为条目持久化在 Session Tree 中，再由上下文构建逻辑转换成模型可读的 summary message。

这个区别很容易被忽略。

`CompactionEntry` 和运行时的 `CompactionSummaryMessage` 不是同一个层次。前者是会话格式里的持久化记录，后者是为了下一次模型调用而生成的消息表示。分支摘要也是一样，Session 中保存 `BranchSummaryEntry`，构建上下文时再把它转换成模型能理解的内容。

## 五、Compaction 如何压缩线性历史

当用户让 Agent 连续搜索代码、修改实现、跑测试、根据报错继续修改时，早期消息会逐渐成为上下文负担。Pi 用 Compaction 处理这条线性历史。

### 触发条件和保留范围

自动压缩的判断可以概括为。

```text
contextTokens > contextWindow - reserveTokens
```

当前官方文档给出的默认值是 `reserveTokens = 16384`，`keepRecentTokens = 20000`。它们可以在 `~/.pi/agent/settings.json` 或项目内的 `.pi/settings.json` 中配置。用户也可以通过 `/compact [instructions]` 手动触发，溢出重试则属于另一种 `overflow` 原因。

这两个参数分别解决不同的问题。

`reserveTokens` 给压缩请求和后续工作留出空间，避免已经贴着窗口上限运行。`keepRecentTokens` 决定压缩后保留多少最近消息，让当前正在进行的工作不被过早总结掉。

### Pi 如何选择切分点

触发后，Pi 会从最新消息向前回溯，直到找到大致覆盖 `keepRecentTokens` 的范围，然后把更早的消息交给摘要请求。

它通常会在 turn 边界切分。一个 turn 从用户消息开始，到下一条用户消息前结束。这样可以尽量避免只保留半个工具调用链，导致模型看到工具调用却看不到对应结果。

如果单个 turn 自己就大到超过保留预算，源码还会允许在 assistant 消息处做更细的切分，并生成 turn-prefix summary。工具调用和工具结果需要成对保留，切分点不会落在孤立的 tool result 上。

### 摘要保存什么

Pi 当前使用的结构化摘要包含六个部分。

```text
## Goal
## Constraints & Preferences
## Progress
## Key Decisions
## Next Steps
## Critical Context
```

对于 coding-agent，`Progress` 不能只写“已经处理了一些文件”。它应该能继续回答这些问题。

- 哪些文件已经读过
- 哪些修改已经完成
- 哪些测试已经运行
- 哪个方案验证失败以及失败原因
- 下一步应该从哪里继续

摘要末尾还会记录 `<read-files>` 和 `<modified-files>`。这些信息会和摘要的 `details` 一起进入后续状态恢复，避免模型压缩后重新猜测工作现场。

摘要请求还会把上一轮摘要作为迭代上下文。这样多次 Compaction 时，新的摘要不是只看最近一小段原始消息，而是可以在旧摘要的基础上继续整理。

### 压缩条目不会把历史“抹掉”

压缩完成后，Pi 会在 Session Tree 中追加一个 `CompactionEntry`。条目里至少有摘要内容、`firstKeptEntryId` 和 `tokensBefore`，还可以包含本次摘要的 usage 与文件操作详情。

构建下一次 LLM 请求时，Pi 从这个条目恢复摘要，再接上 `firstKeptEntryId` 之后仍然保留的消息。模型看到的是“摘要加近期尾部”，而不是所有旧消息，也不是一条没有来源的孤立总结。

这使得 Compaction 既能控制 token，又能保留会话格式中的可追溯边界。

## Branch Summarization 如何保留失败探索

Compaction 处理一条线上的历史，分支摘要处理的是会话树中的另一种遗忘。

```text
root
├── 方案 A
│   └── 测试发现性能不行，放弃
└── 方案 B
    └── 当前正在继续
```

用户从 `方案 A` 的旧节点切换到 `方案 B`，当前路径通常只包含 `root → 方案 B`。如果完全丢掉旧分支，模型可能再次提出已经验证失败的方案 A。

Pi 在 `/tree` 导航到另一条分支时，可以生成 Branch Summary。实现过程可以拆成三步。

1. 找到新旧路径的最近公共祖先，也就是 LCA。
2. 收集 LCA 之后旧分支上的消息，并优先准备较新的内容进入摘要预算。
3. 生成摘要，将它作为 `BranchSummaryEntry` 追加到当前会话路径。

它和 Compaction 的差异可以放在一张表里。

| 维度 | Compaction | Branch Summarization |
| --- | --- | --- |
| 触发 | 接近窗口上限、手动 `/compact` 或溢出重试 | `/tree` 切换会话分支 |
| 目标 | 让线性历史继续装得下 | 带回旧分支的探索成果 |
| 选取范围 | 历史中的可切分前缀 | LCA 之后的旧分支路径 |
| 持久化条目 | `CompactionEntry` | `BranchSummaryEntry` |
| 摘要格式 | 结构化摘要 | 使用同一套结构化摘要 |

这里有一个需要特别修正的细节。Branch Summary 不是另一套固定的五段模板，也不应当被简单理解成固定 2048 token 的摘要。当前 Pi 官方文档说明，Compaction 和 Branch Summarization 共用同一套结构化摘要格式，具体预算会根据待总结内容和上下文空间准备。

分支摘要同样会携带 `<read-files>` 和 `<modified-files>`。Pi 会把工具调用和之前摘要里的文件记录累积起来，避免切换分支后丢掉已经读过或修改过的文件线索。

## 从一次工具调用看完整链路

![一次 Pi Agent 工具调用的上下文处理链路](/img/covers/pi-agent-context-pipeline.svg)

假设用户输入的是“修复 auth.ts 的 bug”，一次典型流程大致如下。

```text
用户输入
  ↓
buildSystemPrompt
  ├── 读取全局与项目上下文文件
  ├── 拼接工具描述和 guidelines
  └── 放入 Skills 清单
  ↓
Session Tree 根到当前叶子的路径
  ↓
AgentMessage[]
  ↓ transformContext()
按扩展或运行时策略裁剪、注入
  ↓ convertToLlm()
过滤和转换为模型消息
  ↓
LLM 返回 read("auth.ts")
  ↓
执行 read 工具
  ↓ truncateHead
最多 2000 行、50KB
  ↓
toolResult 回到 AgentMessage 历史
  ↓
下一次请求前检查上下文预算
  ├── 未到阈值，继续 Agent Loop
  └── 到达阈值，追加 CompactionEntry
```

如果用户中途切换会话树分支，Pi 会在新的路径上追加 `BranchSummaryEntry`。运行时上下文构建逻辑再把这些持久化条目转换成模型看到的摘要消息。

这条链路里，每一层回答的问题不同。

| 层 | 解决的问题 |
| --- | --- |
| 工具截断 | 单条结果太大怎么办 |
| System prompt 组装 | 项目规则如何自动进入请求 |
| `transformContext` / `convertToLlm` | 内部消息如何变成模型消息 |
| Compaction | 线性历史太长怎么办 |
| Branch Summary | 旧分支的探索如何不丢 |

把 `reserveTokens` 调大，解决不了一条 80KB 的工具结果。把工具输出截得很小，也不会自动告诉模型项目必须使用哪条测试命令。每一层都做窄一点，整个 Agent 才容易观察和调整。

## 三个设计判断

### 1. 上下文是每轮重建的投影，不是聊天记录的别名

Session 负责保存可恢复的历史，Agent Context 负责为当前调用选择路径和消息，LLM Message 则是最终发送格式。三者之间存在转换关系。

因此，调试 Agent 失忆时，不能只盯着终端里是否显示过某段文本，还要确认这段文本有没有进入当前叶子路径，是否在 `transformContext` 中被裁掉，是否能通过 `convertToLlm`，以及最终是否被工具结果截断或 Compaction 摘要覆盖。

这比把问题归结成“模型记性不好”更接近真实故障边界。

### 2. 压缩必须保留工作状态，而不只是保留聊天主题

普通聊天摘要可以只保留讨论结论，coding-agent 不行。它还要保留文件关系、修改状态、测试结果和失败尝试。

Pi 把 `readFiles` 和 `modifiedFiles` 放进摘要详情，并在分支摘要中继续累积。这说明上下文压缩的目标不是把过去讲得更短，而是让下一次调用可以继续操作同一个工作现场。

如果自己设计摘要模板，`Goal` 很重要，但 `Progress`、`Key Decisions`、`Next Steps` 和文件操作记录通常更决定恢复质量。

### 3. 摘要应该是扩展点，而不是黑盒

Pi 提供 `session_before_compact` 和 `session_before_tree` 这类扩展事件。扩展可以查看待总结消息、上一轮摘要、文件操作、触发原因和 token 信息，也可以取消默认行为或返回自定义摘要。

这给了应用层一个机会。不同项目可能有不同的状态载体，数据库迁移、前端页面、数据分析 notebook 需要保留的字段并不相同。统一的默认摘要负责兜底，领域扩展负责补充真正影响后续工作的状态。

## 上下文工程不等于权限控制

还有一个边界需要单独说清楚。

系统提示词可以告诉模型哪些文件不要改，Skills 也可以描述一套操作规范，但这些内容本身不是操作系统级的权限边界。Pi 的官方 README 明确说明，它不内置权限系统，进程会使用启动它的用户权限运行。

因此，上下文工程解决的是模型看什么、记什么、何时读取什么。需要限制文件访问、命令执行或网络能力时，还要使用沙箱、容器、进程权限和工具白名单。把一条规则写进 prompt，不能替代真正的安全隔离。


## 总结

Pi Agent 的上下文工程可以概括为一条从原始事件到模型消息的流水线。

工具结果先被限制体积，系统提示词把项目规则按来源和层级组织起来，Session Tree 提供当前工作路径，`transformContext` 和 `convertToLlm` 再把内部消息变成模型协议。历史接近窗口上限时，Compaction 保存线性工作的状态；切换会话分支时，Branch Summary 带回旧探索的结论。

模型不需要记住一切，但当前这一轮必须看到最有用的那部分。Pi 的实现值得研究的地方，也正在这里。它没有把上下文当作一个越堆越大的文本框，而是把上下文变成了可以截断、加载、压缩、持久化和重新投影的工程对象。

