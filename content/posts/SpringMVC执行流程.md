---
title: "SpringMVC执行流程"
date: 2025-12-25 21:05:00
updated: 2026-04-07 22:26:02
categories:
  - "Java"
tags:
  - "Spring"
  - "SpringMVC"
  - "执行流程"
---

# SpringMVC执行流程

请求先到 **DispatcherServlet（前端控制器）**，它负责调度 **HandlerMapping → HandlerAdapter → Controller → ViewResolver → View**。

Spring MVC 采用前端控制器模式，所有请求先进入 DispatcherServlet。DispatcherServlet 通过 HandlerMapping 找到对应的 Controller，再通过 HandlerAdapter 调用方法执行。Controller 返回结果后，如果是视图名则交给 ViewResolver 解析并渲染视图；如果是 @ResponseBody，则通过 HttpMessageConverter 转换为 JSON 返回给客户端。

### SpringMVC是什么?

Spring MVC 是 Spring 提供的一个基于 MVC 设计模式的 Web 框架，通过 DispatcherServlet 作为前端控制器，结合 HandlerMapping、HandlerAdapter 等组件完成请求的分发和处理，支持注解方式开发，能够方便地实现请求参数绑定和响应结果返回。
