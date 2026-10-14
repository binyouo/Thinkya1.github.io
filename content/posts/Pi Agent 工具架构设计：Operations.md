---
title: Pi Agent 工具架构设计：Operations 抽象与 Workspace 切换
date: 2026-08-01 17:05
categories:
  - Agent
  - Tool
  - 架构设计
tags:
  - Agent
  - Tool
  - 架构设计
---
在 Pi Agent 的工具系统中，**Operations 抽象** 是核心设计之一。它把工具的执行逻辑与具体文件系统实现解耦，让 Agent 可以在本地、SSH、Docker 等不同环境中灵活切换。

本文主要分享工具架构的核心设计思路，包括抽象接口、依赖注入、闭包固定实例，以及 Workspace 切换机制。

## 为什么不直接使用 Node.js fs？

很多人第一反应是直接调用 `fs/promises`：

```ts
await fs.access(path);
const buffer = await fs.readFile(path);
```

这种写法存在几个明显痛点：

- **强耦合**：Tool 与具体文件系统实现绑定（本地磁盘、SSH、Docker 沙箱随便一种都行）。
- **测试困难**：单元测试必须创建真实文件，Mock 成本高。
- **环境切换麻烦**：一旦需要切换后端，Tool 代码几乎需要全部重写。

直观上可以理解为：

```text
Read Tool
      ↓
Node.js fs
      ↓
本地磁盘
```

工具和具体实现绑定死了，这不是在给 Agent 装手脚，而是把手脚绑死在本地磁盘上了。

## Operations 抽象接口

为了解决这个问题，我们定义了一个抽象接口 `ReadOperations`：

```ts
export interface ReadOperations {
    readFile: (absolutePath: string) => Promise<Buffer>;
    access: (absolutePath: string) => Promise<void>;
}
```

Tool 层只知道调用这个接口，完全不关心下面用的是 `fs.readFile` 还是 `sshClient.readFile`。

调用关系变为：

```text
Read Tool
      │
      ▼
ReadOperations（抽象接口）
      │
      ▼
Local / SSH / Docker / Mock 等具体实现
```

Tool 依赖的是抽象接口，而不是具体实现。

## 闭包固定实例行为

在创建 Tool 时，我们通常会这样写：

```ts
function createReadTool(options?: {
    operations?: ReadOperations;
}) {
    const ops = options?.operations ?? defaultReadOperations;

    return {
        execute: async (path: string) => {
            await ops.access(path);
            return ops.readFile(path);
        }
    };
}
```

这里用闭包把创建时的 `ops` 固定在 Tool 实例上，实现了**行为稳定**的目的。

不管后续怎么切换 Workspace，Tool 实例的行为永远是确定的。

## Workspace 切换与多环境支持

本地 Agent 用本地 Operations，SSH Agent 用 SSH Operations，切换 Workspace 时不需要修改 Tool 内部代码：

```ts
const localTool = createReadTool({ operations: localOperations });
const sshTool   = createReadTool({ operations: sshOperations });
```

两个 Tool 可以同时存在，互不干扰。

## 工具系统五步管道简述

整个工具系统可大致分为五步：

1. **定义**：定义 Operations 接口
2. **注册**：把具体实现注册到工具系统中
3. **拦截**：可选的预处理/后处理
4. **执行**：调用 Operations 实例的方法
5. **回收**：清理资源或重置状态

我们重点强化了第 4 步的抽象和第 5 步的稳定性。

## 两层错误处理机制

工具执行时推荐采用**两层错误处理**：

- **第一层（工具内部主动识别）**：在 `execute` 方法中主动捕获已知错误类型（如超时、中止、非零退出码），重新包装成具体、可读的错误描述。
- **第二层（框架兜底被动处理）**：工具内部抛出的错误原样透传给框架。

这种做法能给模型提供更有价值的错误反馈。

## 总结：工具架构的核心思想

Pi Agent 工具架构的核心在于**先抽象、再注入、最后稳定**。

通过 Operations 抽象 + 依赖注入 + 闭包固定实例的方式，我们实现了：

- 环境切换的灵活性
- 测试的简易性
- 行为稳定性的保证

这样的设计让 Tool 层代码可以在不同 Workspace 间复用，同时保持了清晰的职责边界。
