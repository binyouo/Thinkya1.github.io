---
title: Ai Agent概念扫盲：Tool、Skill、MCP、ACP 与 Code Mode
date: 2026-10-12 21:38:00
categories:
  - AI
tags:
  - Agent
  - 概念扫盲
  - MCP
  - Skill
  - ACP
  - Code Mode
description: 用一次代码审查串起工具调用、结构化输出、Skill、工具发现、MCP、ACP、A2A、LSP 和程序化编排。
---

[返回总览](/2026/10/12/ai-agent-concepts/) · 上一篇 [模型基础](/2026/10/12/ai-agent-model-basics/)。

假设你要 Agent 审查一个仓库。

它需要知道怎样审查，也需要真的能读代码。代码放在远程平台时，还需要一条接入路径。任务复杂以后，又需要把多次操作组织起来。

Tool、Skill、MCP、Code Mode 就在解决这些不同问题。理解它们最方便的方式，是沿一次实际调用往下看。

<!-- more -->

## Tool、Tool Call、Function Calling

**Tool 是暴露给 Agent 的可执行能力。** 读文件、查工单、运行测试，都可以是工具。

**Tool Call 是一次具体调用请求。Function Calling 是让模型按结构化格式选择函数并生成参数的机制。** 有的 API 把 Function Calling 和 Tool Calling 近似使用；具体接口还可能有托管搜索等工具类型。

下面只是抽象格式，不是某家 API 的完整请求。

```json
{
  "id": "call_01",
  "name": "read_file",
  "arguments": { "path": "/repo/src/login.ts" }
}
```

模型表达了「读这个文件」的意图。执行器还要检查参数、权限和文件是否存在，调用真实代码，再把结果返回。自定义工具与提供方托管工具的执行位置不同，可以参考 [Claude 的工具机制文档](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)。

![模型表达调用，宿主检查和执行，结果回到模型](/images/ai-agent-concepts/tool-call.svg)

比如读文件成功，只说明拿到了内容；运行测试成功，还要看退出状态和测试结论；用户要求的 Bug 是否解决，又是下一层判断。

## 工具调用周围的一圈词

| 名称 | 负责什么 | 在读文件时是什么 |
| --- | --- | --- |
| Tool Definition | 工具的名称、用途和参数结构 | `read_file` 的接口说明 |
| Description | 告诉模型何时用、怎样用 | 文件过大时怎样分页读取 |
| Arguments | 本次具体参数 | 路径、起始行和读取长度 |
| Tool Call ID | 关联调用与结果 | `call_01` 对应这一份结果 |
| Tool Registry | 管理可用工具及实现 | 名称到处理函数的注册表 |
| Handler / Executor | 真正执行操作 | 打开文件并读取内容的代码 |
| Tool Result | 返回内容、状态或错误 | 文本、截断说明、错误原因 |
| Tool Choice | 引导或限制模型选工具 | 允许自动选择或指定某工具 |
| Tool Router | 选择工具或执行路径 | 把代码查询路由到语言服务 |
| Middleware | 统一处理横切逻辑 | 校验、权限、日志、超时 |

工具在 Registry 中存在，不代表模型已经看到了它的完整定义；看到了定义，也不代表当前用户有权执行。目录、模型输入和权限是三层。

## JSON、Schema 和 Structured Output

**JSON 是数据表示格式。JSON Schema 描述数据应当有什么字段、类型和约束。Validation 是按照规则校验。**

例如 `path` 必须是字符串，`limit` 必须是正整数。**Structured Output，结构化输出**，让模型按约定结构生成结果，方便下一段程序处理。

审查报告输出为「问题数组」会比一大段自由文本更容易展示，但至少还要检查三层。

| 检查层 | 例子 |
| --- | --- |
| 语法 | 是不是合法 JSON |
| 结构 | `severity` 是否属于允许的枚举 |
| 业务与权限 | 引用行号是否存在、问题是否真实、路径能否访问 |

符合 Schema 只解决结构层问题。「问题在第 20 行」可以格式完全正确，但第 20 行可能根本没有问题。

**Serialization / Deserialization，序列化与反序列化**，是对象与可传输表示之间的转换。**JSON-RPC** 则规定方法、请求 ID、结果和错误怎样交换；**OpenAPI** 描述 HTTP API 的路径和请求响应结构。它们不能仅因为都能使用 JSON 就看成同一种东西。

## Skill，方法和资源怎样复用

**Skill 是可复用的任务知识、流程与资源包。** 在 [Agent Skills 格式](https://agentskills.io/specification)中，核心是 `SKILL.md`，还可以附脚本、参考文档和模板。

代码审查 Skill 可以规定，先明确改动目标，再沿调用链找影响，运行必要检查，最后提供问题与证据。

它提供的是工作方法。读取代码要靠文件或仓库工具，运行脚本要靠执行环境。即使 Skill 写着「使用数据库工具」，也不能自动产生数据库访问权限。

**Prompt** 是当前任务的指令和输入；Skill 把反复使用的方法放进可维护的包。**Command** 提供显式触发入口；**Hook** 在特定生命周期事件触发逻辑；**Plugin / Extension** 是安装和分发附加能力的包；**Connector / Adapter** 负责外部服务连接或接口适配。

一个插件可以同时带 Skill、MCP 配置和命令。它们是可以组合的部件。

已有的 [MCP 和 Skill，到底是什么关系？](/2026/04/14/MCP和Skill到底是什么关系/)包含更长的审查案例。

## 为什么工具很多时要先看目录

**Progressive Disclosure，渐进式披露**，先让模型看到名称和适用场景，相关时再读取完整说明，需要时再打开附件。这和查手册先看目录一样。

**Tool Search** 从较多工具里寻找当前需要的能力；**Tool Preselection** 在主执行前先筛选候选；**Deferred Loading** 延后加载工具定义等内容；**Dynamic Discovery** 在运行中发现或更新能力；**Lazy Loading** 则是更广泛的按需加载思路。

例如应用连着一百个工具，当前只需要「查代码」。可以先找到相关工具，再把完整参数结构交给模型。

这里延迟加载的可能是文档、Schema、模块、连接或进程。Schema 尚未进入模型上下文时，服务器可能早就连接好了。工具目录缓存命中，也不能证明某次调用一定能成功。

## MCP，连接应用与外部能力

**MCP，全称 Model Context Protocol，统一应用接入外部能力的方式。**

**Host** 是承载 AI 交互的应用；**Client** 是 Host 中与 Server 通信的协议组件；**Server** 暴露能力。它们是软件角色，不能直接推断进程数量。参见 [MCP 官方架构说明](https://modelcontextprotocol.io/docs/learn/architecture)。

Server 可以提供三类核心内容。

| 能力 | 用途 | 示例 |
| --- | --- | --- |
| Tools | 可执行操作 | 查询工单、创建记录 |
| Resources | 可读取的上下文资料 | 文档、数据库结构 |
| Prompts | 参数化提示模板 | 按固定维度分析资料 |

`tools/list` 获取目录，`tools/call` 请求执行工具。应用常会把 MCP 工具转换为模型能理解的调用定义，再把模型请求路由到 Server。

MCP 不规定完整 Agent 的计划、长期记忆和验收策略。「接通 MCP」是接入成功的证据，业务权限和实际结果仍由对应系统负责。

## ACP、A2A、LSP、DAP，连接对象不同

| 协议 | 连接谁 | 最直观的用途 |
| --- | --- | --- |
| ACP，Agent Client Protocol | 客户端与 Agent | 编辑器发任务，显示进度和权限请求 |
| A2A，Agent2Agent | 调用方与远程 Agent 服务 | 提交任务，跟踪状态，取交付物 |
| LSP，Language Server Protocol | 开发工具与语言服务 | 定义、引用、补全、诊断、重命名 |
| DAP，Debug Adapter Protocol | 开发工具与调试适配器 | 断点、单步、变量、调用栈 |

ACP 把会话创建、用户输入、更新和取消等交互定义为方法与通知。恢复会话等可选能力需要双方支持，不能只看「支持 ACP」就假设全部可用。[ACP v1 官方概览](https://agentclientprotocol.com/protocol/v1/overview)列出了这些边界。

直接调用 CLI 是使用命令行入口；ACP 则提供结构化的客户端交互语义。Agent 可以同时支持二者，具体进程布局仍由实现决定。另有同名的 Agent Communication Protocol，看到 ACP 应先确认全称。

A2A 中的 **Agent Card** 描述身份、能力、地址和认证要求；**Task** 是带生命周期的任务；**Message** 是消息；**Part** 是其中的文本、文件或结构化内容单元；**Artifact** 是交付物。[官方规范](https://a2a-protocol.org/latest/specification/)描述的是互操作，不替远程服务实现内部工具和记忆。

LSP 的例子更简单。搜索 `createOrder` 能找出同名文本，但不一定知道哪个引用指向哪个定义。语言服务利用代码语义提供这类关系，具体功能取决于语言服务器。[LSP 官方说明](https://microsoft.github.io/language-server-protocol/overview/)可以继续阅读；运行过程的调试则属于 [DAP](https://microsoft.github.io/debug-adapter-protocol/overview)。

## Protocol、Transport、SDK

**Protocol 是消息格式和交互行为的约定。Transport 是消息怎么传。SDK 是帮助实现或调用接口的代码包。**

`stdio` 使用进程标准输入输出；HTTP 承载请求响应；SSE 常用于服务端向客户端持续推送事件；WebSocket 支持持续双向通信。

同一传输可以承载不同协议，同一协议也可能支持多种传输。是否使用 HTTP，不能单独证明支持 MCP 或 A2A。

## Code Mode，用程序组织工具

**Code Mode 让模型先生成程序，再由执行环境运行程序，组织工具调用。** 循环、条件、聚合和数据筛选可以在程序里完成。不同提供方的实现与命名不完全相同，[Cloudflare 的 Code Mode 文档](https://developers.cloudflare.com/agents/api-reference/codemode/)是一种具体例子。

下面假定宿主已提供 `tools.listProjects` 和 `tools.listIssues`，只是编排示意。

```js
const projects = await tools.listProjects();
const groups = await Promise.all(
  projects.map(p => tools.listIssues({ projectId: p.id }))
);
const result = groups.flat()
  .filter(issue => issue.priority === "high")
  .map(issue => ({ title: issue.title, url: issue.url }));
```

程序查多个项目，筛出高优先级工单，再返回必要字段。模型不必为每个固定查询都参与一次往返判断，但实现还要考虑并发限制、失败和取消。

**PTC，Programmatic Tool Calling，程序化工具调用**，描述相关思路，也可能特指某家托管实现。**Sandbox** 限制代码执行能力；**Host Bridge** 让执行环境中的代码调用宿主提供的受控能力。

脚本能调用工具之后，每次真实操作仍需要相应权限检查。沙箱限制本地文件访问，不会自动限制桥接工具在外部服务里能创建什么。

**Parallel Tool Calling** 是一份模型响应请求多个工具，执行器决定怎样调度。普通工具执行器也可以并行，Code Mode 的特点在于用程序表达编排和处理逻辑。

**Tool Streaming** 把调用信息或参数逐段返回。参数没收全、没校验之前，不能因为已经看到半段 JSON 就默认可执行。

## 把这一篇串起来

代码审查 Skill 提供方法，MCP 接入仓库能力，Function Calling 表达读取请求，执行器返回代码；需要批量处理时，Code Mode 可以组织查询。编辑器通过 ACP 接收进度，LSP 提供符号关系。

下一篇再看外围程序怎样让这件事持续推进、保存状态，并在故障后恢复。

[下一篇：Agent Loop、Runtime 与 Harness](/2026/10/12/ai-agent-loop-runtime/) · [返回总览](/2026/10/12/ai-agent-concepts/)
