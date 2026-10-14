---
title: "RRF 排序融合，混合检索如何统一 BM25 和向量搜索"
date: 2026-07-09 01:04:11
updated: 2026-10-12 21:40:00
categories:
  - "AI"
tags:
  - "RAG"
  - "RRF"
  - "BM25"
  - "向量检索"
---

做混合检索时，会碰到一个很朴素的问题。

BM25 说某篇文档得了 18.6 分，向量检索说另一篇文档的相似度是 0.83。到底谁应该排在前面？

18.6 看起来比 0.83 大得多，但这两个数字根本不在同一把尺子上。直接相加没有意义，随手归一化又会受到查询、模型和数据分布影响。

RRF 提供了一个很省心的思路。

既然各路分数不好比较，那就不比较分数，只比较排名。

## 为什么混合检索需要结果融合

关键词检索和向量检索擅长的事情并不一样。

BM25 根据词项出现情况计算相关性，遇到错误码、产品型号和专有名词时很有优势。查询里明确出现 `ERR_CONNECTION_RESET`，包含同一字符串的文档通常应该优先返回。

向量检索比较的是语义表示。用户问「服务突然连不上了怎么办」，即使文档里没有完全相同的句子，只写了「连接被远端重置」，它也有机会把内容召回。

两路结果放在一起，覆盖面通常比单一路径更好。麻烦在于，它们返回的原始分数没有统一含义。

BM25 分数会受到词频、文档长度和索引语料影响。向量检索还可能使用余弦相似度、点积或距离，不同模型生成的分数分布也不同。

给两路分数直接设置权重，看起来简单，后面却很容易陷入反复调参。数据规模变了，Embedding 模型换了，原来的权重可能就不合适了。

RRF 绕过了这道题。

> 这篇是 [RAG 概念专题](/2026/10/12/ai-agent-rag/)中的排序细节，完整系列见 [Ai Agent概念扫盲](/2026/10/12/ai-agent-concepts/)。

## RRF 怎么计算

RRF 的全称是 Reciprocal Rank Fusion，也就是倒数排名融合。

对于文档 `d`，它的融合分数可以写成下面这样。

$$  
score(d) = \sum_{i=1}^{n} \frac{1}{k + rank_i(d)}
$$

`rank_i(d)` 表示文档 `d` 在第 `i` 路结果中的排名。排名从 1 开始。某篇文档没有出现在一路结果中时，那一路就不给它加分。

`k` 是平滑常数，常见取值是 60。它会削弱第一名和后面名次之间过于悬殊的差距，让多路都排得靠前的文档得到更稳定的优势。这里的 `k` 与检索返回数量 Top K 不同；公式和具体参数可参考 [Elasticsearch 的 RRF 文档](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)。

这里最重要的变化是，原始相关性分数消失了。

无论 BM25 返回 18.6，还是向量库返回 0.83，RRF 只问一件事，这篇文档在各自列表里排第几。

## 手算一个小例子

假设同一个问题得到两组结果。

BM25 的排序是 `文档 A、文档 B、文档 C`。

向量检索的排序是 `文档 B、文档 C、文档 A`。

为了让数字更容易观察，这里暂时取 `k = 0`。真实系统通常会使用更大的平滑常数。

文档 A 在两路中分别排第 1 和第 3，它的分数是

$$  
1/1 + 1/3 = 1.3333  
$$

文档 B 分别排第 2 和第 1，它的分数是

$$  
1/2 + 1/1 = 1.5  
$$

文档 C 分别排第 3 和第 2，它的分数是

$$  
1/3 + 1/2 = 0.8333  
$$

融合后的顺序是 `文档 B、文档 A、文档 C`。

文档 B 没有在 BM25 中拿到第一，但它在两路都很靠前，所以最终超过了只在一路占据第一的文档 A。这正是 RRF 想保留的共识。

## 一个可以直接运行的 Python 实现

RRF 本身并不依赖 LangChain 或向量数据库。只要手里已经有多组排序结果，几十行 Python 就能完成融合。

```python
from collections import defaultdict

def reciprocal_rank_fusion(
    rankings: list[list[str]],
    k: int = 60,
) -> list[tuple[str, float]]:
    """Fuse ranked document lists using Reciprocal Rank Fusion."""
    if k < 0:
        raise ValueError("k must be greater than or equal to 0")

    scores: dict[str, float] = defaultdict(float)

    for ranking in rankings:
        seen_in_ranking: set[str] = set()
        for rank, document_id in enumerate(ranking, start=1):
            if document_id in seen_in_ranking:
                continue
            seen_in_ranking.add(document_id)
            scores[document_id] += 1 / (k + rank)

    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))

bm25_results = ["文档A", "文档B", "文档C"]
vector_results = ["文档B", "文档C", "文档A"]

fused_results = reciprocal_rank_fusion(
    [bm25_results, vector_results],
    k=0,
)

for document_id, score in fused_results:
    print(f"{document_id}: {score:.4f}")
```

运行后得到

```text
文档B: 1.5000
文档A: 1.3333
文档C: 0.8333
```

代码里额外处理了同一文档在一路结果中重复出现的情况。正常的检索器通常不会返回重复 ID，但在合并多个分片或自行拼装结果时，去重可以避免同一路对某篇文档重复加分。

## 在 LangChain 里使用 EnsembleRetriever

下面保留的是旧版 LangChain API 示例，用于理解组合方式，不表示当前版本安装后可直接运行。实际项目应按所用版本核对包名和导入路径；上面的独立 Python 实现不依赖 LangChain。

如果用 LangChain 搭混合检索，RRF 也经常不是自己手写，而是通过 `EnsembleRetriever` 这类组件完成。

一个典型结构是：先准备一批文档，再分别创建 BM25 检索器和向量检索器，最后把两路检索器交给 `EnsembleRetriever` 融合。

```python
import jieba
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

doc_list = [
    "人工智能是计算机科学的一个分支，致力于创造能够模拟人类智能的系统。",
    "机器学习是人工智能的一个子领域，专注于开发能从数据中学习的算法。",
    "深度学习是机器学习的一种方法，使用多层神经网络处理复杂数据。",
    "自然语言处理是人工智能的一个分支，研究计算机与人类语言的交互。",
    "智能助手如小度和天猫精灵使用自然语言处理技术理解用户指令。",
    "自动驾驶汽车利用计算机视觉和深度学习技术识别道路情况。",
    "医疗诊断系统使用机器学习分析患者数据，辅助医生做出诊断决策。",
    "大型语言模型如 GPT 和文心一言能够生成类似人类的文本内容。",
    "计算机视觉技术使机器能够理解和处理视觉信息，如图像和视频。",
    "强化学习是一种机器学习方法，通过奖励和惩罚机制让 AI 学会做决策。",
    "人工智能产业在中国快速发展，成为新的经济增长点。",
    "智能手机的普及改变了人们的生活和工作方式。",
]

def chinese_tokenizer(text):
    return list(jieba.lcut(text))

bm25_retriever = BM25Retriever.from_texts(
    doc_list,
    metadatas=[{"source": f"doc_{i}"} for i in range(len(doc_list))],
    preprocess_func=chinese_tokenizer,
)
bm25_retriever.k = 3

embeddings = HuggingFaceEmbeddings(
    model_name="../bge-large-zh-v1.5",
    model_kwargs={"device": "cpu"},
)

vectorstore = Chroma.from_texts(
    texts=doc_list,
    embedding=embeddings,
    metadatas=[{"source": f"doc_{i}"} for i in range(len(doc_list))],
    persist_directory="./chroma_db_custom_3",
)
vector_retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.5, 0.5],
)

docs = ensemble_retriever.invoke("人工智能在医疗领域的应用")
for index, doc in enumerate(docs, start=1):
    print(index, doc.page_content)
```

这里 BM25 更擅长直接关键词匹配，比如「深度学习」这种查询。向量检索更擅长语义相关但字面不完全一致的问题，比如「智能系统如何理解人类语言」。混合检索则希望把两者的优势放在一起。

原理上，`EnsembleRetriever` 会把不同检索器返回的结果做融合。它关心的是文档在各路结果中的排名，再结合权重得到最终排序。上面给 BM25 和向量检索都设置了 `0.5`，意思是先等权看待两路结果。

如果业务里有大量专有名词、编号和错误码，可以适当提高 BM25 的权重；如果查询更偏自然语言表达，可以提高向量检索的权重。但权重最好通过测试集评估，而不是只凭直觉。

测试时可以准备几类问题。

- 直接关键词匹配：例如「深度学习」
- 语义相关但没有完全相同关键词：例如「智能系统如何理解人类语言」
- 混合查询：例如「人工智能在医疗领域的应用」
- 有歧义的查询：例如「智能产品」

分别观察 BM25、向量检索和混合检索的结果，就能更直观看到 RRF 或加权融合到底改善了什么。

## `k` 到底影响什么

如果 `k = 0`，第一名得到 1 分，第二名得到 0.5 分，第十名只得到 0.1 分。头部名次之间差距很大。

如果 `k = 60`，第一名约为 0.01639，第二名约为 0.01613，第十名约为 0.01429。名次仍然重要，但变化平缓了很多。

较小的 `k` 更强调头部名次，较大的 `k` 更重视多路结果共同提供的信号。60 是常见默认值，不是不可修改的定律。更稳妥的做法，是在自己的查询集上用 Recall、MRR 或 NDCG 等指标评估。

## 多路权重怎么处理

有些场景会更信任其中一路。例如知识库中包含大量编号和术语，BM25 的精确匹配可能比向量语义更重要。

可以给每一路增加权重。

$$  
score(d) = \sum_{i=1}^{n} \frac{w_i}{k + rank_i(d)}
$$

这样仍然绕开了原始分数尺度，只调整各路排名信号的重要程度。

不过权重越多，调参成本也会回来。没有离线评估集时，先从等权 RRF 开始，通常比凭感觉设置一堆系数更稳。

## RRF 的边界

RRF 简单、鲁棒，但它并不会判断一篇文档是否真的回答了问题。

如果关键词检索和向量检索都召回了错误内容，RRF 只会把这些错误结果重新排序。它也会丢掉原始分数中的置信度信息。某一路的第一名只比第二名高一点，和高出一大截，在 RRF 里没有区别。

所以它更适合做召回结果融合，而不是替代完整的相关性判断。

常见链路会是关键词召回与向量召回并行执行，用 RRF 合并候选，再把靠前的结果交给 Cross-Encoder 或大模型做精排。RRF 负责便宜、稳定地汇总多路意见，Reranker 再仔细判断查询和文档之间的相关性。

检索系统不需要一开始就追求复杂。

当两套评分体系无法直接对话时，先让它们各自投票，再根据名次寻找共识。

这就是 RRF 最实用的地方。
