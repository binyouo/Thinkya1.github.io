---
title: Ai Agent概念扫盲：一篇串起 RAG、Embedding、BM25、RRF 与重排
date: 2026-10-12 21:35:00
categories:
  - AI
tags:
  - Agent
  - 概念扫盲
  - RAG
  - Embedding
  - BM25
  - GraphRAG
description: 用一次报销文档查询，串起资料解析、分块、索引、召回、融合、重排、证据组织、RAG 进阶与分层评测。
---

[返回总览](/2026/10/12/ai-agent-concepts/) · 上一篇 [上下文与记忆](/2026/10/12/ai-agent-context-memory/)。

你问「今年出差住宿费最多报销多少」，模型训练时学到的知识通常回答不了你公司的最新规定。

系统可以先找到公司的报销文件，再用文件里的规定回答。**这种检索外部资料、结合资料生成回答的方式，就是 RAG，Retrieval-Augmented Generation，检索增强生成。**

这篇用一个构造的报销查询例子，把 RAG 的概念顺着链路讲完。检索多少条、分块多大，都只是示例，不是推荐参数。

<!-- more -->

## RAG 有资料准备和查询回答两条线

![RAG 的资料准备与查询回答：权限和版本贯穿检索，候选经过融合、重排与证据组织](/images/ai-agent-concepts/rag-pipeline.svg)

资料准备，把文档变成能检索的内容。查询回答，找到证据并生成答案。

2020 年的 [RAG 原始论文](https://arxiv.org/abs/2005.11401)研究了模型与检索记忆结合的具体方法；现在应用开发里常用更宽的含义，未必复制原论文架构。搜索引擎、SQL、文件检索也可以参与，不是只有「向量数据库加聊天框」一种形式。

## Ingestion，先把资料读对

**Ingestion 是资料接入和准备。Data Source 是来源，Loader / Connector 负责读取。Parsing 是解析。**

PDF 可能包含双栏、表格、脚注和扫描件。**OCR** 识别图片中的文字；**Layout Analysis** 识别版面结构；**Cleaning** 清理噪声；**Deduplication** 去重。

如果「北京 500 元、其他城市 350 元」被解析成错列，后面的检索和回答可能完全忠实，却忠实于一份错误内容。

**Metadata** 是来源、标题、版本、时间、权限等附加信息。**Document ID / Chunk ID** 标识文档和片段；**Provenance** 保留可追溯来源；**ACL** 表示访问控制信息。

报销文件更新后，**Incremental Indexing** 只更新变化内容，**Reindexing** 重新建立索引。如何识别旧版本、处理删除以及保证权限同步，属于整个资料生命周期。

文档分块与资料结构可继续参考 [Azure AI Search 的分块说明](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents)。

## Chunking，切块时别切断意思

**Chunk 是检索和上下文组织使用的内容单元。Chunking 是把资料切成这些单元。**

报销文档十几页，问题只涉及住宿。整份交给模型可能浪费，按主题切成片段，就能更精准地取出相关章节。

| 方法 | 怎样切 | 常见取舍 |
| --- | --- | --- |
| Fixed-size | 按固定长度 | 简单，但可能切断句子或表格 |
| Recursive | 逐层按段落、句子等边界 | 尽量保留结构，仍需控制块大小 |
| Structure-aware | 按标题、章节、代码结构 | 依赖解析质量 |
| Semantic | 按语义变化 | 需要相应算法或模型，结果要评估 |
| Parent-child | 小块用于检索，再读取大父块 | 精确匹配后补上下文 |
| Sentence Window | 命中句子后补邻近句 | 补回指代和条件 |
| Overlap | 相邻块保留部分重叠 | 降低边界损失，增加重复 |

例如「500 元」被单独切出去，城市、日期和适用条件不在同一块，答案就容易出错。块太大，又可能混入机票、交通等无关规定。

**Late Chunking** 则先让较长文本参与表示计算，再得到块向量，尝试保留跨块上下文。它改变嵌入阶段的处理，不能等同于简单增加最终返回片段长度。见 [Late Chunking 论文](https://arxiv.org/abs/2409.04701)。

读取父块或邻近片段时，权限检查也要覆盖扩展出来的内容。

## Embedding，把内容变成可比较的表示

**Embedding 是把文本、图片等对象转换为数值表示。Embedding Model 是生成这种表示的模型。**

```text
「住宿费上限」 → [0.12, -0.48, 0.73, ...]
```

每一维通常不能直接解释成「住宿」或「金额」。检索主要比较整体表示之间的关系。

**Dense Vector，稠密向量**，通常大多数分量非零；**Sparse Vector，稀疏向量**，大多数分量为零；**Dimension** 是分量数量；**Norm** 是向量长度；**Normalization** 按规则归一化。

**Bi-Encoder，双编码器**，分别编码问题和文档，再比较表示。文档表示可以提前计算，查询时只需要编码新问题，适合大量候选的初步检索。

同一索引要使用兼容的表示空间。换了嵌入模型，不能只因向量维度一样，就默认旧向量仍可直接使用。

## BM25，关键词也很有用

**Keyword Search 按词项匹配检索。Inverted Index，倒排索引，记录一个词出现在哪些文档或位置。**

**TF** 是词频，**DF** 是包含该词的文档数，**IDF** 反映该词的区分度；**Analyzer** 处理分词、归一化等步骤。**BM25** 是常用词项相关性评分方法，考虑词频饱和与文档长度等因素。细节可读 [Stanford 的 BM25 说明](https://nlp.stanford.edu/IR-book/html/htmledition/okapi-bm25-a-non-binary-model-1.html)。

「住酒店能报多少」和「住宿费标准」字面不同，语义检索可能有帮助。但文件编号 `FIN-2026-08`、错误码或函数名，精确词项匹配又很重要。

实际效果还受分词、数据和查询影响，不能固定认为向量检索一定优于关键词检索。

## Cosine、Dot Product、L2，怎样比较向量

**Cosine Similarity** 比较方向相似程度；**Dot Product** 计算点积；**Euclidean / L2 Distance** 比较欧氏距离。

向量单位归一化后，点积可以等于余弦相似度。采用哪一种，是否归一化，应该遵循模型与索引要求。

「取消订单流程」和「取消订单失败」可能很相似，但一个问操作步骤，一个问故障原因。向量相似高，不自动表示可以回答当前问题。

## 向量库、索引、ANN，主要解决效率

**Vector Database** 提供向量存储、索引、查询与过滤等能力；**Vector Index** 是用于搜索的数据结构。数据库还可以包含权限、元数据和其他查询功能，不能只看一个索引算法。

**kNN** 找最近的 K 个邻居；**Exact Search** 在给定距离下做精确搜索；**ANN** 做近似最近邻搜索，用一定近似换速度和资源。

| 方法 | 直观理解 |
| --- | --- |
| HNSW | 在分层近邻图里逐步寻找候选 |
| IVF | 先划分区域，查询时重点搜索部分区域 |
| PQ，乘积量化 | 压缩表示，降低存储等资源需求 |

它们可能组合使用。效率、内存和近邻召回之间的取舍可以看 [Faiss 官方索引说明](https://github.com/facebookresearch/faiss/wiki/Faiss-indexes)。

HNSW 的图表达近邻关系，知识图谱的图表达实体关系，两个「图」不应混淆。

## 查询表达不清楚，先处理问题

用户说「今年这个还能报吗」，系统至少需要弄清哪个费用、哪个年份和哪个制度。

**Query Rewrite** 改写查询；**Query Expansion** 扩展同义词或缩写；**Multi-query** 用多个查询覆盖不同表达；**Query Decomposition** 把复杂问题拆成子问题；**Query Routing** 决定查哪个来源；**Multi-hop Retrieval** 根据前一次结果继续检索。

例如问「北京住宿和机场交通合计最多报多少」，可能需要分别查两种标准，再核对是否有组合限制。改写不得悄悄改变用户的城市、日期或问题范围。

**HyDE，Hypothetical Document Embeddings**，先生成假设性答案文本，再利用其向量检索真实资料。假设文本只帮助找资料，不能当证据。见 [HyDE 原始论文](https://arxiv.org/abs/2212.10496)。

## 召回、Top K、Threshold

**Retrieval / Recall Stage，召回阶段**，先找到可能相关的候选。这里「召回」表示一个处理阶段，不等于后面统计的 Recall 指标。

**Top K** 取排名前 K 的结果；**Threshold** 按分数阈值筛选。关键词取前 30，向量取前 30，重排后取前 5，最后进入上下文 3 块，这些 K 可以不同。

分数能否当置信度、阈值怎样设，需要用可回答与不可回答的问题验证。相似度 0.8 不能自动解释为「80% 正确」。

## Hybrid Search、Fusion、RRF

**Hybrid Search，混合检索**，结合关键词和向量等多种方法。**Fusion** 把多路结果合并。

**Score Fusion** 使用分数，必要时处理尺度差异；**Rank Fusion** 主要利用名次。**RRF，Reciprocal Rank Fusion，倒数排名融合**，是一种常见排名融合。

```text
RRF(d) = 各路 1 / (k + 该文档在该路的排名) 之和
```

某篇文档在某一路没有出现，那一路不加分。这里的 `k` 是平滑常量，与「取前 K 条」的 K 不同。[Elasticsearch 的 RRF 文档](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)解释了公式和实现参数。

例如关键词列表是 A、B、C，向量列表是 B、C、A，B 在两路都靠前，融合后可能超过 A。融合利用排名信号，不直接判断文档中的内容是否真的回答了问题。

这部分已有一篇 [RRF 排序融合](/2026/07/09/RRF排序融合/)，包含手算和 Python 示例，可以从这里继续往下看。

## Reranker、Cross-Encoder，把候选仔细比较

**Rerank 是对已经召回的候选重新排序。Reranker 是执行重排的模型或组件。**

**Cross-Encoder，交叉编码器**，联合处理问题与候选文本，给出相关性信号。初步检索用双编码器从大量资料找候选，之后用交叉编码器精细比较较少候选，是一种常见组合。[Sentence Transformers 的 Retrieve & Re-Rank](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)给出了示例。

「酒店预订流程」可能和住宿问题很像，但「住宿报销上限」才回答金额。重排可以帮助区分，不过正确文件根本没进候选时，重排无法把它凭空找回来。

## MMR、Context Packing，挑哪些证据进去

**MMR，最大边际相关性**，在相关性与多样性之间平衡，减少重复候选。**Context Packing** 在上下文预算内选择、去重和排列证据。

如果前五块全是同一段住宿标准的副本，应该补充适用日期、地区和例外条件，而不是把五份重复内容全部送给模型。

这一步可能再次丢掉信息。检索系统找到了正确文档，不代表最终 Context 中仍保留了那条关键限制。

## Grounding、Citation、Abstention

**Grounding** 让具体说法由证据支持；**Citation** 标明来源；**Abstention** 在依据不足时明确无法确认；**Hallucination** 是生成与事实或可用依据不符的内容。

回答「北京住宿上限 500 元」时，引用至少要支持城市、金额、适用时间和人群。链接存在只证明能打开资料，不证明资料支持这句话。

如果只找到旧制度，就说明日期限制，继续找新资料，或给出无法确认。更完整的错误治理可以读已有的 [怎么减少大模型幻觉？](/2026/04/10/怎么减少大模型幻觉/)。

## GraphRAG，用实体关系补充检索

**Knowledge Graph，知识图谱**，用实体与关系组织信息。**Entity** 是实体，**Relation** 是关系，**Attribute** 是属性，**Triple** 是「主体—关系—客体」。

例如「财务部—发布—报销制度」。**Entity Resolution** 判断不同名字是否指同一个对象；**Ontology / Schema** 定义类型与关系规则；**Graph Traversal** 沿关系查找；**Community** 是联系较紧密的一组节点。

广义 **GraphRAG** 是利用图结构辅助检索生成的一类方法。微软 GraphRAG 则是具体系统，涉及实体关系和社区报告等索引。使用图数据库，不等于实现了微软 GraphRAG。

微软的 **Local Search** 结合实体相关图信息与原文；**Global Search** 利用社区报告处理整体性问题；**DRIFT** 结合社区信息与后续查询扩展。具体方式见 [官方查询概览](https://microsoft.github.io/graphrag/query/overview/)。

问某项住宿上限，直接定位原文就可能足够；问一组制度总体有哪些主题，则是另一种检索需求。图结构有成本，也可能抽错关系，应按问题验证收益。

## Agentic RAG、Corrective RAG、Self-RAG

**Agentic RAG** 让 Agent 决定是否检索、查哪里、怎样改写、是否继续，以及证据是否足够。查到旧制度后主动寻找新版本，是一个简单例子。它是一类组织方式，具体实现差异很大。

**Corrective RAG** 围绕检索质量评价和纠正组织流程，相关原论文包含检索评价、知识处理与外部搜索等机制，见 [CRAG 论文](https://arxiv.org/abs/2401.15884)。

**Self-RAG** 原论文包含训练和反思 Token 等设计。给普通提示词加上「检查一下资料」，不能直接称为完整实现 Self-RAG。见 [Self-RAG 原始论文](https://arxiv.org/abs/2310.11511)。

名字里的 Agentic、Corrective、Self 描述关注方向，不保证质量更好。新增调用可能增加延迟，新增评价模型也可能判断错误。

## ColBERT、Late Interaction 和其他方向

**Late Interaction，后期交互**，分别形成较细粒度表示，再匹配。**ColBERT** 是代表方法之一，保留 Token 级表示，与每段只用一个向量、或问题和文档一起进入 Cross-Encoder 都不同。见 [ColBERT 论文](https://arxiv.org/abs/2004.12832)。

**Multimodal RAG** 检索和利用图片、表格、音频等资料。**Text-to-SQL** 把自然语言问题转为数据库查询。**Structured Retrieval** 使用字段过滤、SQL 或图查询取得资料。

「上季度各部门实际报销多少」可能适合查结构化数据库；「新制度怎样规定」可能适合文档检索。并非所有问题都应改写成向量搜索。

## 评测先看检索，再看回答

某问题共有 4 条相关资料，系统前 5 条结果找回其中 2 条，这是一个构造例子。

| 指标 | 衡量什么 | 示例 |
| --- | --- | --- |
| Precision@K | 前 K 条里相关结果的比例 | Precision@5 = 2/5 = 40% |
| Recall@K | 全部相关资料中找回的比例 | Recall@5 = 2/4 = 50% |
| Hit@K | 前 K 条是否有至少一个相关结果 | 当前查询 Hit@5 = 1，多查询可汇总比例 |
| MRR | 第一个相关结果有多靠前 | 第 2 名命中，该查询倒数排名为 1/2 |
| MAP | 多个相关结果的排名表现 | 对查询的平均精确率再做平均 |
| nDCG | 考虑位置与不同相关程度 | 高度相关资料排前面通常更好 |
| ANN Recall | 找回多少精确近邻 | 比较近似结果与精确向量搜索结果 |

ANN Recall 衡量近邻找回，相关性 Recall 衡量回答依据找回，两者不一样。指标还需说明标签和未标注结果怎样处理，参见 [Stanford 的检索评测说明](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html)。

回答层的 **Answer Correctness** 看正确性，**Faithfulness** 看是否忠实于给定材料，**Answer Relevance** 看是否回答问题，**Context Precision / Recall** 看上下文相关程度和覆盖，**Citation Accuracy** 看引用是否支持声明。

忠实于错误旧制度的回答仍然可能错。同名指标在不同框架中实现也可能不同，例如 [Ragas 的 Context Precision](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/)考虑了排名等因素，不能直接等同于普通 Precision@K。

## 回答错了，沿这张表找原因

| 现象 | 优先检查 |
| --- | --- |
| 新制度根本搜不到 | 接入、解析、版本、权限、索引更新 |
| 正确制度排得很后 | 查询表达、召回、融合和重排 |
| 检索到了，模型没有看到 | 去重、截断、Context Packing |
| 上下文正确，回答还是错 | 指令、证据利用和生成 |
| 引用存在，结论无依据 | 片段定位、归因和推断边界 |
| 资料已更新，仍答旧标准 | 索引和缓存失效、数据版本 |

RAG 的重点是把需要的依据找出来、送到模型面前，并正确使用。先检查这条链路，再决定要不要加更复杂的方法。

[深入：RRF 计算与代码](/2026/07/09/RRF排序融合/) · [深入：减少幻觉](/2026/04/10/怎么减少大模型幻觉/) · [下一篇：多 Agent 与电脑操作](/2026/10/12/ai-agent-collaboration-computer-use/)
