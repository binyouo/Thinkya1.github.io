---
title: "Biny-Agent 的工具发现设计：辅助模型预选与按需检索"
date: 2026-10-18 00:40:00
categories:
  - AI
tags:
  - Biny
  - Coding Agent
  - MCP
  - 工具发现
  - 上下文工程
description: "Biny 怎样从工具目录中预选能力，在执行中用 ToolSearch 补充，以及辅助模型带来的成本。"
---

接入多个 MCP Server 后，工具会越来越多，但一个任务通常只用到其中几个。把所有工具的完整 Schema 都交给主模型，会占用不少上下文。

Biny 目前采用的是「基础工具常驻 + 辅助模型预选 + ToolSearch 按需发现」。我想让主模型一开始就拿到可能用得上的工具，执行中有遗漏，再自己搜索。

<!-- more -->

## 工具怎样交给主模型

运行时用 `ToolRegistry` 维护工具目录，里面有工具名称、描述和参数 Schema。回合开始前，`capabilityPreselection` 把名称和简短描述交给辅助模型，让它结合当前任务和近期对话，返回相关工具名。预选时不需要读取完整参数 Schema。

Biny 核对这些名称后，将选中工具的完整定义提供给主模型。自动模式下，常驻的工具是 `Read`、`Write`、`Edit`、`Bash`、`ToolSearch` 和 `read_tool_result`，再合并预选结果与历史已发现的有效工具。Skill 另有预选流程，可以和工具预选并行。

![工具目录经过辅助模型预选，形成主模型当前可用的工具集；执行中缺少能力时，由 ToolSearch 补充](/images/biny-tool-discovery/tool-selection.svg)

辅助模型只负责选工具。什么时候调用、参数怎么填，由主模型决定，实际调用仍经过统一的工具执行器。

如果预选遗漏了能力，主模型可以调用 `ToolSearch`。查询中包含完整的注册工具名时，直接在本地匹配；没有精确命中时，就把当前合格工具的名称和描述交给辅助模型做语义选择。结果经过注册表校验后，新增工具的 Schema 会提供给下一步模型请求。

这一版没有用 BM25 或向量数据库。非精确查询的相关性判断，主要由辅助模型完成。

## 和 Codex 的差别

我参考的 [Codex 开源版本](https://github.com/openai/codex/blob/ca466061d64f0b44f416135c7fd06aa7af850bbc/codex-rs/core/src/tools/handlers/tool_search.rs)采用按需发现：主模型调用 `tool_search`，本地 BM25 对延迟加载的工具元数据排序，再返回匹配工具。这条搜索路径不需要额外请求辅助模型。

Biny 多做了一次回合前预选。如果选得准，主模型第一次请求就能直接调用相关工具，省去一轮搜索。辅助模型也可以根据意图选择，比如用户用中文描述任务，而工具名称和描述是英文。

代价是多一次模型请求。辅助模型需要读工具目录，会增加 Token 开销和首轮等待；选漏了，执行中还要再搜索。两种方式都能减少主模型接收的 Schema，区别在于发现工具的时机和相关性判断的方式。这里的 Codex 对比限于链接中的源码版本。

## 我现在的取舍

我目前保留预选和会话里已经发现的有效工具。对普通代码修改，基础工具往往就够用，预选的收益可能很小；涉及多个外部系统时，提前选工具更有用。

随着小模型能力提高，我仍然想保留辅助模型做语义判断，但也想减少它每次需要读的目录。接下来考虑的是：ToolSearch 先在本地检索一批候选，结果明确就直接返回，模糊时再交给辅助模型。

![后续考虑的两阶段检索：先在本地缩小候选范围，候选模糊时再请求辅助模型](/images/biny-tool-discovery/two-stage-search.svg)

*这张图是后续考虑的方案。当前实现仍是完整工具名本地匹配，其余查询交给辅助模型。*

这也需要验证：如果本地检索漏掉了正确工具，辅助模型就无从选择。小模型更便宜之后，先检索再判断是否比直接读目录划算，还得看任务完成率、总 Token 和整条执行链路的耗时。

---

项目：[Biny-Agent](https://github.com/binyouo/Biny-Agent)。实现可以看 [回合前预选](https://github.com/binyouo/Biny-Agent/blob/0639cfa307cfbb8e4bb3738cfdb107934b214a62/src/agent/capabilityPreselection.ts)和 [ToolSearch](https://github.com/binyouo/Biny-Agent/blob/0639cfa307cfbb8e4bb3738cfdb107934b214a62/src/tools/toolSearch.ts)。
