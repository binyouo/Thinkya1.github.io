---
title: Pi Agent 工具架构设计：三层类型 + 五步管道 + 并行调度 + 错误处理
date: 2026-08-01 17:05
categories:
  - Agent
  - 架构设计
  - Tool
tags:
  - Agent
  - Tool
  - 架构设计
---
在 Pi Agent 的工具系统中，工具的抽象和执行机制是整个架构的核心。本文系统梳理工具定义的三层类型、调用时的五步管道、并行执行策略，以及错误处理的特殊设计。

## 一、三层类型：为什么”一个工具”要分三层来定义？

在 Pi Agent 里，一个完整的工具定义被拆成了**三层**，目的是让不同层职责清晰、扩展性强：

### 第一层：Tool（一张”名片”）

这是最基础的一层，只定义工具的**基本信息**：

- toolName
- description
- parameters（Schema）
- 其他元数据

这一层就像工具的**名片**，告诉 Agent 它能做什么。

```ts
export interface Tool {
  name: string;
  description: string;
  parameters: any;
  // ...
}
```

### 第二层：AgentTool（加上了”执行能力”）

在 Tool 的基础上，添加了**实际执行逻辑**：

- execute 方法
- 错误处理
- 资源管理等

```ts
interface AgentTool extends Tool {
  execute: (params: any) => Promise<any>;
}
```

这一层是真正可以调用的工具。

### 第三层：ToolDefinition（产品层再加东西）

在 AgentTool 之上，添加了**产品层**需要的额外信息：

- 包装后的执行函数
- 前置/后置钩子
- 结果统一格式

```ts
interface ToolDefinition extends AgentTool {
  // 包装后的执行函数
  wrappedExecute: (params: any) => Promise<ToolResult>;
}
```

## 桥接两层：wrapToolDefinition

为了把第二层的执行能力桥接到第三层，Pi 提供了 `wrapToolDefinition` 工具：

```ts
function wrapToolDefinition(tool: AgentTool): ToolDefinition {
  return {
    ...tool,
    wrappedExecute: async (params) => {
      // 执行前置钩子
      await beforeToolCall?.(params);
      
      try {
        const result = await tool.execute(params);
        return { result, isError: false };
      } catch (err) {
        return { result: err, isError: true };
      }
    }
  };
}
```

## 为什么非要分三层？

- **职责分离**：第一层只管描述，第二层管执行，第三层管包装和扩展。
- **扩展性强**：想加新特性（日志、限流、缓存）时，只需要在第三层修改。
- **可组合性好**：可以用不同的 `wrapToolDefinition` 实现不同的策略。

## 二、五步管道

模型调用工具时，不是直接调用一个函数，而是走了一套完整的**五步管道**：

### 第 1 步：prepareArguments —— 兼容性垫片

处理不同模型返回的参数格式（比如有些模型返回 camelCase，有些 snake_case）。

### 第 2 步：validateToolArguments —— Schema 验证

使用 JSON Schema 对参数进行严格验证，防止无效输入。

### 第 3 步：beforeToolCall —— 前置钩子（可阻止执行）

允许开发者在执行前做一些操作（比如权限检查、限流），也可以通过返回 `false` 来阻止执行。

### 第 4 步：tool.execute —— 实际执行

真正调用工具的执行逻辑（通常是第二层的 `execute`）。

### 第 5 步：afterToolCall —— 后置钩子（可修改结果）

允许开发者在执行后修改结果、添加额外信息等。

**管道终点**：`ToolResultMessage`（统一格式的消息）。

这种五步管道让工具调用更加安全、可控、可扩展。

## 三、并行 vs 串行：一个批次的工具不是”一起跑就完了”

模型经常一次调用多个工具（比如搜索 + 总结 + 数据库查询），但并行执行不能简单用 `Promise.all`。

Pi 的调度策略是**一票否决**：

- 并行执行三阶段设计：
  1. 准备阶段（prepare）
  2. 并行执行阶段（execute in parallel）
  3. 收尾阶段（after parallel）

如果任何一个工具执行失败，会触发一票否决，整个批次被取消并返回错误。

## 四、永不抛出：工具出错也是一条消息

Pi Agent 工具系统**永不抛出异常**到 Agent Loop，而是统一返回 `ToolResult`：

```ts
interface ToolResult {
  result: any;
  isError: boolean;
  errorMessage?: string;
}
```

### 6 种错误类型 + 1 种产物

工具出错时，会被包装成统一的 `ToolResult`，而不是直接抛出错误。

关键代码在 `tool.execute` 的双重防护：

- 内部主动捕获异常
- 外部框架兜底包装成消息

**为什么”伪装成消息”是最佳处理方式？**

因为：
- 模型最擅长处理消息格式的错误
- 错误描述越具体，模型纠错能力越强
- 避免了异常穿透到 Agent Loop，保持 Loop 的稳定性

## 五、【进阶】Operations 抽象：工具执行不等于系统调用

问题：如果工具直接写死系统调用（如 `fs.readFile`），那就很难在不同环境中复用。

**解法**：让工具不直接调系统 API，而是通过**最小接口**调用。

每个工具定义自己需要的最小接口（比如 `ReadOperations`），然后通过依赖注入的方式传入具体实现。

这样：
- 工具代码可以跨环境复用
- Mock 测试变得容易
- 不同 Workspace 切换时行为稳定

---

**总结**

Pi Agent 的工具架构通过**三层定义 + 五步管道 + 并行调度 + 统一错误消息 + Operations 抽象**，实现了高度灵活、可测试、可扩展的工具系统。

这套设计真正做到了把 Agent 的手脚管住。

