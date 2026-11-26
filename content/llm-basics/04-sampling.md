---
title: 生成与采样
summary: 拿到概率分布之后，到底选哪个词？
---

## 从 logits 到概率

模型最后一层输出的是每个候选 token 的分数（logits）$z_i$，经过带**温度** $T$ 的 softmax 变成概率：

$$
p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}
$$

- $T \to 0$：几乎总是选概率最高的词（贪心，稳定但单调）
- $T = 1$：原始分布
- $T > 1$：分布变平，更随机、更有“创意”，也更容易胡言乱语

## 交互：调一调温度

```demo softmax
{
  "title": "温度与采样实验",
  "prompt": "今天天气真",
  "candidates": { "好": 4.2, "不错": 3.3, "晴朗": 2.8, "糟糕": 1.6, "热": 1.4, "冷": 0.9, "适合睡觉": 0.2 },
  "temperature": 1
}
```

:::tip 试试看
1. 把温度拉到 **0.1**，连续采样 100 次——几乎全是“好”。
2. 把温度拉到 **3**，再采样 100 次——冷门词也频繁出现了。
3. 设置 **Top-k = 3**：只在前 3 名里选，灰掉的词永远不会被选中。
:::

## Top-k 与 Top-p

| 策略 | 做法 | 特点 |
| --- | --- | --- |
| 贪心 | 永远选最大概率 | 确定性，容易重复 |
| Top-k | 只保留概率最高的 k 个 | 简单，但 k 固定不够灵活 |
| Top-p（核采样） | 保留累计概率达到 p 的最小集合 | 候选数随分布自适应 |

温度对分布形状的影响一图看懂：

```chart
{
  "type": "line",
  "height": 260,
  "caption": "同一组 logits 在不同温度下的概率分布",
  "data": {
    "labels": ["好", "不错", "晴朗", "糟糕", "热", "冷", "适合睡觉"],
    "datasets": [
      { "label": "T = 0.5", "data": [0.808, 0.134, 0.049, 0.004, 0.003, 0.001, 0.0], "borderColor": "#3b5bdb", "tension": 0.3 },
      { "label": "T = 1",   "data": [0.542, 0.221, 0.134, 0.04, 0.033, 0.02, 0.01], "borderColor": "#b06cf7", "tension": 0.3 },
      { "label": "T = 2",   "data": [0.335, 0.214, 0.167, 0.091, 0.083, 0.064, 0.045], "borderColor": "#f76c9b", "tension": 0.3 }
    ]
  }
}
```

## 自己实现一个采样函数

```js run
function softmax(logits, T = 1) {
  const m = Math.max(...logits);
  const e = logits.map(z => Math.exp((z - m) / T));
  const s = e.reduce((a, b) => a + b);
  return e.map(x => x / s);
}
const words = ["好", "不错", "晴朗", "糟糕"];
const logits = [4.2, 3.3, 2.8, 1.6];

for (const T of [0.3, 1, 2]) {
  const p = softmax(logits, T);
  console.log(`T=${T}`, words.map((w, i) => `${w}:${(p[i] * 100).toFixed(1)}%`).join("  "));
}
```

```quiz
{
  "question": "想让模型写出更稳定、可复现的代码，温度应该？",
  "options": ["调高到 2 以上", "调低（接近 0）", "保持 1 不变", "温度不影响结果"],
  "answer": 1,
  "explain": "低温度让分布更尖锐，输出更确定。创意写作则可以适当调高。"
}
```

:::details 拓展阅读：为什么要先减去最大值？
`Math.exp` 在输入很大时会溢出为 `Infinity`。由于 softmax 对所有 logits 同时加减一个常数结果不变，减去最大值可以保证数值稳定。
:::
