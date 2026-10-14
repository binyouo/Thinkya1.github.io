---
title: Ai Agent概念扫盲
date: 2026-10-12 21:40:00
categories:
  - AI
tags:
  - Agent
  - 概念扫盲
  - RAG
  - MCP
  - Skill
description: 按术语逐项解释 Skill、MCP、ACP、Code Mode、RAG、Memory、Harness 等 Agent 概念，每项附对应专题入口。
---

这篇按术语逐项解释常见的 AI Agent 概念。先看每项的简短说明，想了解完整流程、例子和边界，再进入对应专题。

<!-- more -->

## 协议与工具

**[Skill](/2026/10/12/ai-agent-tools-protocols/)：** 可复用的任务知识、流程与资源包。它告诉 Agent 一类事情应该怎么做，通常以 `SKILL.md` 为核心，还可以带脚本、模板和参考资料。比如代码审查 Skill 规定先看改动目标，再查影响、验证并输出报告。真正读文件和跑测试，仍需要工具。

**[MCP](/2026/10/12/ai-agent-tools-protocols/)：** Model Context Protocol，模型上下文协议，统一 AI 应用接入外部工具和资料的方式。比如把 GitHub 查询能力接到 Agent 应用里。MCP Server 可以提供工具、可读取的资源和提示模板；应用负责连接、发现和路由调用。

**[ACP](/2026/10/12/ai-agent-tools-protocols/)：** 这里指 Agent Client Protocol，Agent 客户端协议，连接编辑器等客户端与 Agent。客户端发送用户任务，Agent 返回进度、工具操作和权限请求。比如在一个编辑器里使用不同编码 Agent。看到 ACP 时先确认全称，因为也有其他同名缩写。

**[A2A](/2026/10/12/ai-agent-tools-protocols/)：** Agent2Agent，让调用方与远程 Agent 服务交换任务、状态和交付物。比如把一项资料调查交给远程 Agent，再取得报告。MCP 侧重接入工具和资料，ACP 侧重客户端交互，A2A 侧重远程 Agent 的任务互操作。

**[LSP](/2026/10/12/ai-agent-tools-protocols/)：** Language Server Protocol，语言服务器协议，提供代码定义、引用、类型、补全和错误诊断等语言服务。文本搜索能找到同名字符串，LSP 可以帮助确定某处引用究竟指向哪个定义。

**[DAP](/2026/10/12/ai-agent-tools-protocols/)：** Debug Adapter Protocol，调试适配器协议，提供断点、单步、变量和调用栈等调试能力。LSP 帮助理解代码，DAP 帮助观察程序运行过程。

**[Tool](/2026/10/12/ai-agent-tools-protocols/)：** 工具，是 Agent 可以使用的一项具体操作能力，比如读文件、查数据库、运行命令或操作浏览器。模型通过工具取得外部信息，或让外面的程序执行真实动作。

**[Tool Call](/2026/10/12/ai-agent-tools-protocols/)：** 工具调用，是使用某个工具的一次具体请求。`read_file` 是工具，读取 `/repo/login.ts` 是一次 Tool Call。调用请求、工具执行结果和用户任务完成，是不同状态。

**[Function Calling](/2026/10/12/ai-agent-tools-protocols/)：** 函数调用机制，让模型用结构化格式表达「调用哪个函数、传什么参数」。通常由应用执行函数，再把结果交回模型；托管工具则由提供方执行相应操作。它负责表达调用，MCP 负责一种外部能力接入方式。

**[JSON Schema](/2026/10/12/ai-agent-tools-protocols/)：** 描述数据需要具备哪些字段、类型和约束。例如工具参数里的 `path` 必须是字符串。程序按 Schema 校验，可以发现格式问题，但还要另行检查路径是否存在、是否允许访问。

**[Structured Output](/2026/10/12/ai-agent-tools-protocols/)：** 结构化输出，让模型按照约定结构生成数据，例如把审查结果输出成一个问题数组。它方便程序处理，格式符合要求之后，事实和业务条件仍需验证。

**[Tool Search](/2026/10/12/ai-agent-tools-protocols/)：** 工具搜索，从较多工具中寻找当前任务需要的能力，再加载相关定义。比如当前只需要查工单，就先找到工单查询工具，减少无关工具说明进入上下文。

**[Progressive Disclosure](/2026/10/12/ai-agent-tools-protocols/)：** 渐进式披露，先给名称和简介，需要时再加载完整说明和附件。读 Skill 时可以先看目录，确定相关后再读正文。Lazy Loading、Deferred Loading 也涉及按需或延后加载，但要确认延迟的是文档、工具定义、连接还是进程。

**[Code Mode](/2026/10/12/ai-agent-tools-protocols/)：** 让模型先写程序，再由执行环境运行程序，用循环、条件、筛选和聚合组织工具调用。比如一段代码查询多个项目，只返回高优先级工单。它可能减少模型往返和中间数据，但也需要处理代码错误、权限和执行状态。

**[PTC](/2026/10/12/ai-agent-tools-protocols/)：** Programmatic Tool Calling，程序化工具调用，用程序组织工具操作的相关思路，也可能特指某家提供方的实现。理解时要继续看程序在哪里运行、怎样调用宿主工具、哪些结果回到模型。

**[Plugin / Extension](/2026/10/12/ai-agent-tools-protocols/)：** 插件或扩展，用来安装和分发附加能力。一个插件可以同时包含 Skill、工具连接配置、命令或 Hook。Hook 在特定事件触发逻辑，Command 则提供显式命令入口。

## Agent 与工作流

**[Agent](/2026/10/12/ai-agent-loop-runtime/)：** 在本系列的 LLM 应用语境中，指围绕目标，根据任务与反馈选择行动、使用工具并推进工作的系统。比如发现测试失败后，自行查日志、定位原因、修改并重新验证。模型负责判断，外围程序负责执行和状态管理。

**[Workflow](/2026/10/12/ai-agent-loop-runtime/)：** 工作流，预先组织步骤与分支。比如「解析文档 → 检索 → 生成 → 校验」。Agent 更侧重根据反馈动态决定下一步；实际系统经常把工作流与 Agent 组合使用。

## 模型与推理

**[LLM](/2026/10/12/ai-agent-model-basics/)：** Large Language Model，大语言模型，用于理解输入和生成内容。它可以生成文字、代码和工具参数。聊天产品通常还包含工具、历史存储和执行程序，产品与模型不是同一个对象。

**[Token](/2026/10/12/ai-agent-model-basics/)：** 模型处理文本时使用的单位，不固定等于一个汉字、单词或字符。Tokenizer 负责文本与 Token 编号之间的转换，Input Tokens 和 Output Tokens 分别描述输入、输出的计量。

**[Context Window](/2026/10/12/ai-agent-model-basics/)：** 上下文窗口，一次模型调用可容纳的上下文范围。容量大不代表其中的信息都能被有效利用；输入、输出和推理预算怎样计算，应看对应接口。

**[Inference / Reasoning](/2026/10/12/ai-agent-model-basics/)：** Inference 指运行已训练的模型来计算输出；Reasoning 更强调分析和逻辑推导。两者都可能译成「推理」，但普通回答也会执行 Inference，不一定涉及复杂 Reasoning。

**[Prefill / Decode](/2026/10/12/ai-agent-model-basics/)：** Prefill 处理已有输入，Decode 逐步生成后续 Token。长输入和长输出带来的耗时可能发生在不同阶段；Streaming 则把内容或事件逐段返回，提供更早的反馈。

**[Temperature / Top p / Top k](/2026/10/12/ai-agent-model-basics/)：** 控制生成采样的参数，影响候选 Token 的分布和选择范围。低 Temperature 不保证答案正确；生成采样的 Top k 与检索返回数量 Top K，属于不同环节。

**[Fine-tuning](/2026/10/12/ai-agent-model-basics/)：** 微调，通过训练调整模型参数来适应任务或数据。SFT、偏好优化等涉及训练方法，LoRA 是参数高效适配的一种方法。读 Skill、查 RAG、保存记忆通常属于运行时信息组织，没有直接更新模型权重。

## 上下文与记忆

**[Prompt](/2026/10/12/ai-agent-context-memory/)：** 当前任务的指令与输入，有些语境也泛指整份模型输入。例如「只根据这份文档回答，资料没有提到的内容标为未知」。Prompt Engineering 关注怎样把目标、例子、约束和输出要求写清楚。

**[Context](/2026/10/12/ai-agent-context-memory/)：** 上下文，本次模型调用实际可用的信息，可能包括用户问题、历史、工具定义、工具结果、检索资料和记忆。信息保存在系统里，不代表这次一定交给了模型。

**[History](/2026/10/12/ai-agent-context-memory/)：** 历史交互记录，例如过去的用户消息、模型回答和工具结果。界面显示的历史可以比本次模型输入更多，系统通常需要选择、裁剪或压缩后再发送。

**[Memory](/2026/10/12/ai-agent-context-memory/)：** 记忆，为后续任务保留和使用的信息，例如用户偏好、项目约束和过去的经验。它可以存在文件或数据库里，不一定要用向量库。保存之后，还需要按作用域检索、处理冲突和检查时效。

**[Context Engineering](/2026/10/12/ai-agent-context-memory/)：** 上下文工程，管理什么信息、在什么时候、以什么形式进入模型。例如把完整日志放到文件里，先提供失败摘要和读取入口，让模型需要时再查细节。

**[Compaction](/2026/10/12/ai-agent-context-memory/)：** 上下文压缩，把较长历史整理成继续工作所需的材料。应保留目标、约束、进度、决定和验证结果。它可能丢失细节，摘要也不能替代已经变化的文件和真实业务状态。

## 检索与 RAG

**[RAG](/2026/10/12/ai-agent-rag/)：** Retrieval-Augmented Generation，检索增强生成，先获取外部依据，再结合依据回答。比如先检索公司的最新报销制度，再解释额度。完整链路包括资料准备、检索、排序、证据组织、生成与核查。

**[Chunking](/2026/10/12/ai-agent-rag/)：** 分块，把资料切成适合检索和放入上下文的片段。块太小可能丢掉条件，块太大可能混入无关内容。例如「500 元」应尽量保留城市、日期和适用范围。

**[Embedding](/2026/10/12/ai-agent-rag/)：** 嵌入，把文本、图片等内容转成数值表示，供检索等任务比较。语义向量可以帮助找到字面不同但含义接近的内容，不过向量相似不证明它能回答问题。

**[BM25](/2026/10/12/ai-agent-rag/)：** 常见的关键词相关性评分方法，利用词项匹配、词频和文档长度等信号。错误码、文件编号、函数名等精确术语，往往需要这类匹配能力。

**[Vector Database / ANN](/2026/10/12/ai-agent-rag/)：** 向量数据库提供向量存储、索引和查询等能力；ANN 是近似最近邻搜索，以一定近似换取速度和资源收益。HNSW、IVF、PQ 是相关索引与压缩方法，主要解决检索效率问题。

**[Hybrid Search](/2026/10/12/ai-agent-rag/)：** 混合检索，结合关键词、向量等多种检索方法。比如一边匹配制度编号，一边理解「住酒店能报多少」的含义，再合并候选。

**[RRF](/2026/10/12/ai-agent-rag/)：** Reciprocal Rank Fusion，倒数排名融合，利用文档在不同结果列表里的名次合并排序，避免直接比较不同尺度的原始分数。它汇总排名信号，不直接判断内容是否正确。

**[Reranker](/2026/10/12/ai-agent-rag/)：** 重排器，对已经召回的候选做更细的相关性判断并重新排序。Cross-Encoder 是一种常见模型形式，会联合处理问题与候选内容。正确资料没有进入候选集时，重排无法把它找回来。

**[Grounding / Citation](/2026/10/12/ai-agent-rag/)：** Grounding 要求具体说法由证据支持，Citation 标明来源。链接存在之后，还要确认来源支持对应说法，包含当前日期和适用条件。证据不足时可以明确无法确认，这叫 Abstention。

**[GraphRAG](/2026/10/12/ai-agent-rag/)：** 利用图结构辅助检索与生成的一类方法。知识图谱组织实体及其关系；微软 GraphRAG 是一个具体实现，还涉及社区报告等索引。使用图数据库，不自动等于实现了该系统。

**[Agentic RAG](/2026/10/12/ai-agent-rag/)：** 让 Agent 参与决定是否检索、查哪里、怎样改写问题、是否继续，以及证据是否足够。查到旧制度后继续寻找新版本，是一个简单例子。Self-RAG、Corrective RAG 则有各自的研究机制，不能仅凭名称视为同一种方法。

## 运行与状态

**[Agent Loop](/2026/10/12/ai-agent-loop-runtime/)：** Agent 的控制循环，准备上下文、调用模型、执行工具、取得观察，再决定继续、等待或结束。一次模型生成结束，不代表整个任务已经完成。

**[ReAct](/2026/10/12/ai-agent-loop-runtime/)：** Reasoning 与 Acting，强调判断和行动交替推进。比如原先怀疑网络故障，读日志后发现数据库权限错误，随后调整排查方向。它与前端 UI 库 React 是不同概念。

**[Engineering Loop](/2026/10/12/ai-agent-loop-runtime/)：** 工程闭环，从目标和验收标准出发，实施变更、获取真实反馈、根据反馈修正并交付。测试、业务状态和界面检查可以提供反馈。不断修改却从不验证，闭环就缺少重要一环。

**[Runtime](/2026/10/12/ai-agent-loop-runtime/)：** 运行环境。语言 Runtime 可以指 Node.js、Python 等环境；Agent Runtime 则承载 Agent 循环、工具执行、状态和生命周期。具体可以是库、服务或多个组件。

**[Harness](/2026/10/12/ai-agent-loop-runtime/)：** 围绕模型组织执行与反馈的外围机制，常涉及指令、工具接口、上下文、调度、权限、恢复和验收。Harness Engineering 关注怎样让这些部分配合，使任务能够持续、正确、可验证地推进。它与 Runtime 的范围有重叠。

**[Session / Turn / Run](/2026/10/12/ai-agent-loop-runtime/)：** Session 是带标识的交互或执行上下文，Turn 是一轮交互，Run 是一次运行实例，具体边界依系统定义。Process 是操作系统进程，一个进程可以服务多个 Session，一个 Run 也可以启动多个工具进程。

**[State](/2026/10/12/ai-agent-loop-runtime/)：** 状态，记录任务或系统现在处于什么阶段，例如运行中、等待输入、失败或完成。判断某类事实时，以对应的 Source of Truth，也就是权威记录为准；工单是否存在，应核对工单系统。

**[Persistence / Checkpoint](/2026/10/12/ai-agent-loop-runtime/)：** Persistence 是持久化，让进程退出后数据仍可读取；Checkpoint 是保存从某个边界恢复所需的状态。保存聊天历史不等于保存了完整工具进度，也不保证能从任意一行代码继续。

**[Resume / Reconnect](/2026/10/12/ai-agent-loop-runtime/)：** Resume 从可恢复边界继续工作，Reconnect 恢复通信连接。界面重新连接成功，不代表后台任务重新执行，也不代表恢复机制完整。

**[Retry / Idempotency](/2026/10/12/ai-agent-loop-runtime/)：** Retry 是重试，Idempotency 是幂等性，在约定范围内重复同一请求，其预期业务效果与执行一次相同。超时不证明操作未成功；响应丢失后可以先核对真实状态，再决定是否重试。

## 协作与界面

**[Multi-agent / Subagent](/2026/10/12/ai-agent-collaboration-computer-use/)：** Multi-agent 是多个 Agent 协作，Subagent 是被委派子任务的 Agent。它们可以分工、独立审查或并行处理，但需要明确上下文、文件责任和结果汇总方式；数量增加也会增加协调成本。

**[Handoff](/2026/10/12/ai-agent-collaboration-computer-use/)：** 把控制权交给另一个 Agent，例如客服把后续处理移交给退款 Agent。让子 Agent 返回一份报告则通常属于 Agent-as-a-Tool，主 Agent 收到结果后继续负责，交互语义不同。

**[Computer Use / ACI](/2026/10/12/ai-agent-collaboration-computer-use/)：** Computer Use 是通过工具观察和操作电脑界面的能力，可利用 DOM、可访问性树、截图和鼠标键盘。ACI 是 Agent 与计算机的交互接口设计，关注观察和操作怎样帮助模型完成任务。点击保存之后，还要确认真实保存结果。

## 缓存与观测

**[Cache Hit](/2026/10/12/ai-agent-cache-observability/)：** 缓存命中，找到满足复用条件的计算状态或结果。它可能命中输入前缀计算、完整答案、工具结果或工具目录，必须先说明缓存对象。命中率高不自动证明整个任务更快。

**[KV Cache](/2026/10/12/ai-agent-cache-observability/)：** 保存注意力计算中的 Key、Value 表示，让自回归模型生成后续 Token 时复用已有计算。这里的 KV 是模型中间表示，不是保存用户偏好的长期记忆数据库。

**[Prompt Cache / Response Cache](/2026/10/12/ai-agent-cache-observability/)：** Prompt Cache 通常复用符合条件的稳定输入前缀计算，模型仍生成新输出；Response Cache 复用完整回答。前缀命中缓存后，里面的信息仍计入逻辑上下文，不会扩大上下文窗口。

**[Trace / Logs / Metrics](/2026/10/12/ai-agent-cache-observability/)：** Trace 关联一次过程中的多个操作，Span 描述其中一段操作；Logs 记录离散事件，Metrics 汇总数量和分布。它们帮助判断哪里慢、哪里失败，持久恢复仍需要另外的状态与执行机制。

**[Latency / TTFT](/2026/10/12/ai-agent-cache-observability/)：** Latency 是从指定起点到终点的耗时，TTFT 是首 Token 延迟，端到端延迟则看任务提交到完成的总时间。首字出现得快，后面的工具和外部任务仍可能让总时间很长。

## 安全与评测

**[Sandbox / Approval](/2026/10/12/ai-agent-safety-evaluation/)：** Sandbox 限制代码能接触的资源；Approval 确认这次具体动作是否获准。Authentication 确认身份，Authorization 确认可执行范围。这几层需要配合，连接工具或读到 Skill 不会自动授予额外权限。

**[Prompt Injection](/2026/10/12/ai-agent-safety-evaluation/)：** 提示注入，用输入或外部资料中的指令诱导 Agent 偏离任务或越权。例如网页要求读取密钥，这仍是网页内容，不能自行变成用户授权。Trust Boundary，信任边界，规定不同来源的信息具有怎样的权威。

**[Test / Eval / Verifier](/2026/10/12/ai-agent-safety-evaluation/)：** Test 检查系统行为，Eval 评估一组任务上的表现，Verifier 检查当前结果是否达到验收要求。Agent 说「创建成功」之后，应核对目标对象是否正确存在；测试通过也要说明覆盖了哪些行为。

**[Acceptance Criteria](/2026/10/12/ai-agent-safety-evaluation/)：** 验收标准，明确什么结果才算完成。比如登录修复要求正确凭据通过、错误凭据被拒绝、旧登录方式仍兼容。Spec 描述预期行为与约束，PRD 描述用户、问题、范围和目标。

**[Baseline / Ablation](/2026/10/12/ai-agent-safety-evaluation/)：** Baseline 是比较基线，Ablation 是消融，通过去掉或替换一个机制检查它的贡献。比如用同一查询集比较有无重排，才能判断新增 Reranker 是否带来收益。

想继续看已有文章，可以读 [MCP 和 Skill，到底是什么关系？](/2026/04/14/MCP和Skill到底是什么关系/)、[RRF 排序融合](/2026/07/09/RRF排序融合/)和 [怎么减少大模型幻觉？](/2026/04/10/怎么减少大模型幻觉/)。各专题附官方规范、项目文档和原始论文。
