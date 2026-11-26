---
title: 分词：文本如何变成数字
summary: 神经网络只认识数字，分词器（Tokenizer）负责把文字翻译成数字序列。
---

## 为什么需要分词

模型的输入必须是数字。最朴素的做法有两种，但各有问题：

:::tabs
@tab 按字符切
每个字符一个 token。词表很小，但序列会**非常长**，模型难以学到“词”的含义。

```text
"lower" → ["l", "o", "w", "e", "r"]   # 5 个 token
```
@tab 按单词切
每个单词一个 token。序列短，但词表会**爆炸**，而且遇到新词（如 “ChatGPTify”）就无能为力。

```text
"lower" → ["lower"]   # 1 个 token，但词表需要几百万项
```
@tab 子词（BPE）✅
折中方案：高频片段合并成一个 token，罕见词拆成几个片段。现代 LLM 基本都用这种方式。

```text
"lowest" → ["low", "est"]   # 2 个 token
```
:::

## BPE 算法

BPE（Byte Pair Encoding）的训练过程只有一句话：**反复把出现次数最多的相邻一对合并成新 token**。

```demo steps
{
  "title": "BPE 训练过程（分步）",
  "steps": [
    { "title": "从单个字符开始", "body": "语料：`low lower lowest`\n\n初始切分：`l o w` · `l o w e r` · `l o w e s t`" },
    { "title": "统计相邻对", "body": "`l+o` 出现 3 次，`o+w` 出现 3 次，`w+e` 出现 2 次……\n\n选出现最多的 `l+o`。" },
    { "title": "合并", "body": "把所有 `l o` 替换成新 token `lo`：\n\n`lo w` · `lo w e r` · `lo w e s t`" },
    { "title": "重复", "body": "继续合并 `lo+w → low`，再合并 `low+e → lowe`……直到词表达到目标大小（GPT-2 约 5 万）。" },
    { "title": "使用", "body": "推理时按**相同顺序**应用这些合并规则，即可把任意新文本切成 token。" }
  ]
}
```

## 动手试试

在下面输入任何文本（中英文均可），拖动滑块观察 BPE 是如何一步步合并的。颜色相同 = 同一个 token。

```demo tokenizer
{
  "title": "BPE 分词器实验台",
  "text": "low lower lowest newer newest wider widest low low",
  "merges": 6,
  "maxMerges": 30
}
```

:::question 观察
1. 合并次数为 0 时，token 数等于什么？
2. 把文本换成重复度很高的句子，压缩比会怎样变化？
:::

## 用代码实现一次合并

```js run
// 统计相邻字符对出现次数，找出最高频的一对
const words = ["low", "lower", "lowest"].map(w => w.split(""));
const freq = {};
for (const w of words)
  for (let i = 0; i < w.length - 1; i++) {
    const pair = w[i] + "+" + w[i + 1];
    freq[pair] = (freq[pair] || 0) + 1;
  }
console.log(freq);
const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
console.log("最高频：", best);
```

```quiz
{
  "question": "BPE 每一步合并的是什么？",
  "options": ["最长的单词", "出现次数最多的相邻 token 对", "随机两个字符", "词典中预先定义的词"],
  "answer": 1
}
```
