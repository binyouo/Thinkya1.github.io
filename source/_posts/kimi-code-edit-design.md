---
title: "用了 Kimi Code 后，我又重新看了一遍 Coding Agent 的 Edit 设计"
date: 2026-10-10 05:24:48
categories:
  - AI
tags:
  - Coding Agent
  - Codex
  - Claude Code
  - Kimi Code
  - Biny
---

最近 GPT-6.1 Sol 实在是有点慢，想着既然要等那么久，不如换 Kimi 试试，刚好搭配 Kimi Code 用了一下。

用的过程中发现，Kimi Code 的 `Edit` 设计和 Codex 不太一样。

Codex 主要采用 `apply_patch`，让模型通过 Patch 描述文件修改；而 Kimi Code 用的是传统的 `old_string → new_string` 字符串替换。

另外最近还有一个让我感兴趣的变化：Codex 在 GPT-6.1 Sol 这样的新模型上，已经使用了 **Code Mode** 来编排工具调用。

我个人感觉，这可能和模型能力的提升有关。模型越来越擅长编写代码和处理复杂的工具调用，Harness 也开始让模型承担更多的编排工作。

当然，Code Mode 和 Patch 并不是互相替代的关系，一个负责工具编排，一个负责文件编辑。

之前设计 Biny-Agent 的 Edit 时，我其实就思考过这些方案。借着这次使用 Kimi Code，重新翻了一遍源码，也顺便整理一下目前几个 Coding Agent 的设计区别。

<!-- more -->

## 1. Codex：以 Patch 为中心

Codex 的 `apply_patch` 是一种结构化文件编辑协议。

模型不需要输出完整文件，而是提交包含文件路径、上下文及修改内容的 Patch。

例如：

```diff
*** Begin Patch
*** Update File: src/config.ts
@@
-const timeout = 3000;
+const timeout = 5000;
*** End Patch
```


它的优势是一次 Patch 可以表达多个修改区域，甚至跨文件的创建、修改、删除和移动。

从 Codex 的 Rust 源码来看，它会解析 Patch，再通过上下文匹配定位修改位置。

比较有意思的是，它并非只有严格字符串匹配，还会尝试忽略行尾空白、首尾空白以及部分 Unicode 字符差异。

这种设计能够减少模型生成 Patch 时因为格式问题导致的失败，但也引入了另一个问题：当文件中存在相似代码时，需要确保上下文能够准确定位目标。

**Patch 的主要优势是表达能力，而不仅仅是节省 Token。**

但同一次 Patch 能描述多个文件修改，不代表这些修改天然构成一个原子事务。

### Codex 的另一个变化：Code Mode

我在最新的模型配置中注意到，GPT-6.1 Sol 使用了 `code_mode_only`，同时仍然保留 `apply_patch` 的工具配置。

Code Mode 允许模型通过 JavaScript 组织工具调用，例如先搜索多个文件，再根据结果决定修改哪些内容，而不是所有步骤都由独立的顶层工具调用串联。

这意味着，Codex 正在把更多工具编排交给模型，但底层的文件修改协议仍然可以使用 Patch。

我觉得这是值得观察的方向，不过目前还不能简单认为 Code Mode 一定更快，或者一定是模型能力提升后才采用的设计。它仍然需要考虑执行开销、权限和错误处理。

![Code Mode 和 Patch 的关系](/images/kimi-code-edit/code-mode-patch.svg)

Code Mode 负责工具编排，Patch 负责描述文件修改，两者可以组合使用。

## 2. Claude Code：精确字符串替换

Claude Code 的标准 `Edit` 采用 `old_string` 和 `new_string`。

模型提供要修改的旧内容和新内容，工具负责匹配并执行替换。

默认要求旧文本唯一匹配，如果出现多个位置，就需要提供更多上下文，或者使用 `replace_all`。

相比 Patch，这种接口明显更简单。

模型不需要组织 Patch 语法，只需要准确描述原内容和修改后的内容。

但它也有局限：一旦模型复制的缩进、空格、换行不准确，就可能匹配失败；修改多个不相邻的位置时，也往往需要多次调用 Edit。

不过 Claude Code 最近在处理文件变化方面做了调整。

从 v2.1.208 开始，在满足读取权限等条件时，即使文件在上次 Read 后发生了变化，只要 `old_string` 仍能在当前文件中唯一、精确匹配，也可以继续编辑。

这点我觉得挺合理。

文件其他部分发生变化，不代表当前要修改的代码也已经失效。相比单纯通过整个文件版本判断，这能减少部分无意义的失败。

## 3. Kimi Code：实现很直接

Kimi Code 最新 TypeScript 版本的 Edit 实现比较简单。

核心链路是：

`EditTool → FileEditService → EditService`

执行时先读取整个文件，再通过字符串匹配得到更新后的内容，最后写回文件。

所以这里需要区分：

**模型只输出修改的片段，不代表磁盘只写入被修改的几个字节。**

Kimi 的实现本质上仍然是全文件读取、内存替换、全文件写回。

对于普通代码文件，这种方式我认为没有太大问题。文件读写本身通常远没有模型推理与多轮工具调用昂贵。

另外，我一开始看到 Kimi Code 显示 `+1 -1`，还以为它采用了什么不同的修改算法。

看完 TUI 源码才发现，它是对 `old_string` 和 `new_string` 计算 Diff。终端显示出来的很多行可能只是视觉换行，实际文件里仍然是一条逻辑行。

因此这个统计并不完全等于最终文件的 Git Diff。

从模型接口来看，我觉得 Kimi Code 的 Edit 确实很优雅：简单、直观，工具定义也不复杂。

但它在文件版本校验和提交安全方面，仍然有值得进一步核对的地方。工具接口简单，不代表底层的并发问题可以忽略。

![三种 Agent 的文件编辑链路](/images/kimi-code-edit/editing-flow.svg)

图中最后一层是概念上的归纳，不表示三种 Agent 使用相同的文件写入实现。

## 4. 三种设计怎么选？

| 维度 | Codex | Claude Code | Kimi Code |
| --- | --- | --- | --- |
| 编辑方式 | Patch | String Replace | String Replace |
| 多位置修改 | 一次 Patch 可描述多个位置 | 通常多次调用 | 通常多次调用 |
| 匹配策略 | 上下文匹配，有一定容错 | 精确匹配 | 精确匹配 |
| 模型输出成本 | 与 Patch 大小有关 | 需复制旧文本 | 需复制旧文本 |
| 核心特点 | 表达力强 | 接口简单 | 实现直接 |


其实很难判断哪一种方案绝对更好。

对于小范围修改，字符串替换已经足够。

对于复杂重构，Patch 可以在一次工具调用中表达更多修改。

但 Patch 也不一定总是更省 Token。如果模型生成的 Patch 频繁失败，需要多次读取和重试，最终成本未必低于字符串替换。

**真正应该衡量的是完成一次正确编辑的总成本，而不是单次 Edit 调用有多简洁。**

## 5. 回到我自己的 Biny-Agent

Biny 的 Edit 设计其实在之前就考虑过这些问题。

目前保留了默认 `str_replace`、实验性 Hashline，以及针对支持原生结构化 Patch 的模型提供的 `apply_patch` 适配。

它们采用不同的修改描述方式，但文件提交尽量复用相同的安全处理逻辑。

我现在反而不太想继续给 Edit 增加更多功能。

三套协议并不意味着一定比一套好，增加的匹配规则、执行分支和边界处理，都需要额外维护。

相比继续讨论哪种协议最先进，我更想通过真实任务对比它们的首次成功率、Token 消耗、重试次数与错误修改率。

如果简单的字符串替换已经足够稳定，就没有必要为了所谓的架构完整性而引入复杂设计。

## 最后

这次从 Kimi Code 的 Edit 看到了一个挺有意思的问题。

我们经常讨论 Coding Agent 的模型能力，却容易忽略 Harness 里的文件编辑工具。

同样一个修改需求，可以由模型输出 Patch，也可以使用字符串替换，甚至可以利用行号和内容 Hash 定位。

不同方案真正的取舍，涉及模型能力、工具调用成本、编辑成功率，以及文件系统的安全边界。

随着模型能力提升，我觉得 Harness 的一个方向可能是：**让模型承担更多动态编排，让程序继续负责确定性的执行与安全约束。**

但这也只是我目前的观察。Code Mode 是否真的比传统工具调用更有效率，Patch 是否比 String Replace 更适合复杂任务，仍然需要实验验证。

对 Biny 来说，我现在更倾向于先把现有方案测清楚，而不是继续增加新的编辑协议。

---


**参考源码**

- [Codex — apply_patch](https://github.com/openai/codex/tree/main/codex-rs/apply-patch)
- [Codex — 模型配置](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json)
- [Claude Code — Tools Reference](https://code.claude.com/docs/en/tools-reference)
- [Kimi Code — TypeScript EditTool](https://github.com/MoonshotAI/kimi-code/blob/main/packages/agent-core-v2/src/agent/tools/edit/editTool.ts)
- [Biny-Agent](https://github.com/binyouo/Biny-Agent)
