---
title: "SpringIOC"
date: 2025-11-24 18:51:00
updated: 2026-04-07 22:26:02
categories:
  - "Java"
tags:
  - "Spring"
  - "IOC"
  - "DI"
---

### 什么是 IoC?

IoC （Inversion of Control ）即控制反转/反转控制。它是一种思想不是一个技术实现。描述的是：Java 开发领域对象的创建以及管理的问题。

例如：现有类 A 依赖于类 B

- **传统的开发方式** ：往往是在类 A 中手动通过 new 关键字来 new 一个 B 的对象出来
- **使用 IoC 思想的开发方式** ：不通过 new 关键字来创建对象，而是通过 IoC 容器(Spring 框架) 来帮助我们实例化对象。我们需要哪个对象，直接从 IoC 容器里面去取即可。

从以上两种开发方式的对比来看：我们 “丧失了一个权力” (创建、管理对象的权力)，从而也得到了一个好处（不用再考虑对象的创建、管理等一系列的事情）

**为什么叫控制反转?**

- **控制** ：指的是对象创建（实例化、管理）的权力
- **反转** ：控制权交给外部环境（IoC 容器）

### IoC 解决了什么问题?

IoC 的思想就是两方之间不互相依赖，由第三方容器来管理相关资源。这样有什么好处呢？

1. 对象之间的耦合度或者说依赖程度降低；
2. 资源变的容易管理；比如你用 Spring 容器提供的话很容易就可以实现一个单例

### IOC和DI的区别？

**IoC（控制反转, Inversion of Control）** 是一种设计思想/原则：把对象的控制权（创建、生命周期、依赖获取等）从应用程序代码中“反转”到框架或容器。也就是说：**不是对象去主动创建或查找依赖，而由外部容器来负责提供（控制）这些依赖。**

**DI（依赖注入, Dependency Injection）** 是实现 IoC 的**一种具体技术/方式**——把依赖（对象）“注入”到目标对象中。常见注入方式：构造器注入、Setter 注入、字段注入。

IoC 是设计思想，DI 是具体的实现方式；

IoC 是理论，DI 是实践；

### Bean 的生命周期

第一个阶段是实例化。Spring 容器会根据 BeanDefinition，通过反射调用 Bean 的构造方法创建对象实例。如果有多个构造方法，Spring 会根据依赖注入的规则选择合适的构造方法。

第二阶段是属性赋值。这个阶段 Spring 会给 Bean 的属性赋值，包括通过 `@Autowired`、`@Resource` 这些注解注入的依赖对象，以及通过 `@Value` 注入的配置值。

第三阶段是初始化。这个阶段会依次执行：

- `@PostConstruct` 标注的方法
- InitializingBean 接口的 afterPropertiesSet 方法
- 通过 `@Bean` 的 initMethod 指定的初始化方法

第四阶段是使用 Bean。比如我们的 Controller 调用 Service，Service 调用 DAO。

最后是销毁阶段。当容器关闭或者 Bean 被移除的时候，会依次执行：

- `@PreDestroy` 标注的方法
- DisposableBean 接口的 destroy 方法
- 通过 `@Bean` 的 destroyMethod 指定的销毁方法

### 项目启动时Spring的IoC会做什么？

第一件事是扫描和注册 Bean。IoC 容器会根据我们的配置，比如 `@ComponentScan` 指定的包路径，去扫描所有标注了 `@Component`、`@Service`、`@Controller` 这些注解的类。然后把这些类的元信息包装成 BeanDefinition 对象，注册到容器的 BeanDefinitionRegistry 中。这个阶段只是收集信息，还没有真正创建对象。

第二件事是 Bean 的实例化和注入。这是最核心的过程，IoC 容器会按照依赖关系的顺序开始创建 Bean 实例。对于单例 Bean，容器会通过反射调用构造方法创建实例，然后进行属性注入，最后执行初始化回调方法。
