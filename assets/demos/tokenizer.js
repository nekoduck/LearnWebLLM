// BPE 分词演示：在输入文本上实时训练 BPE，拖动滑块观察合并过程
// 配置：{ "title": "...", "text": "初始文本", "merges": 初始合并次数, "maxMerges": 滑块上限 }
export default function mount(el, cfg, { escapeHtml }) {
  const maxMerges = cfg.maxMerges || 40;
  el.innerHTML = `
    <textarea class="tk-text" rows="3" spellcheck="false"></textarea>
    <div class="demo-row" style="margin-top:10px">
      <label>合并次数 <input type="range" class="tk-n" min="0" max="${maxMerges}" step="1"><span class="val tk-nv"></span></label>
      <label><input type="checkbox" class="tk-space" checked> 显示空格为 ·</label>
      <span class="pill tk-stat"></span>
    </div>
    <div class="tk-out"></div>
    <details class="tk-detail"><summary>合并规则（按学习顺序）</summary><ol class="tk-rules"></ol></details>
    <style>
      .tk-out { line-height: 2.2; padding: 10px; background: var(--bg-soft); border-radius: 8px; font-family: var(--mono); font-size: 15px; word-break: break-all; min-height: 48px; }
      .tk-tok { display: inline-block; padding: 0 3px; margin: 1px; border-radius: 4px; line-height: 1.6; white-space: pre; cursor: default; }
      .tk-tok.new { outline: 2px solid var(--fg); }
      .tk-detail { margin-top: 10px; font-size: 14px; }
      .tk-rules { font-family: var(--mono); columns: 3 180px; margin: 6px 0; }
      .tk-rules li.last { color: var(--primary); font-weight: 700; }
    </style>`;
  const ta = el.querySelector('.tk-text'), slider = el.querySelector('.tk-n');
  ta.value = cfg.text || 'low lower lowest newer newest wider widest';
  slider.value = cfg.merges ?? 8;
  const palette = (i) => `hsl(${(i * 67) % 360} 75% var(--tk-l, 85%))`;
  const style = document.createElement('style');
  style.textContent = `:root[data-theme="dark"] .demo-tokenizer { --tk-l: 30%; }`;
  el.appendChild(style);

  function train(text, n) {
    // 以空白切分为“词”（保留前导空格，类似 GPT-2），词内从单字符开始合并
    const words = text.match(/\s*\S+|\s+$/g) || [];
    let seqs = words.map((w) => Array.from(w));
    const rules = [];
    for (let step = 0; step < n; step++) {
      const freq = new Map();
      for (const s of seqs) for (let i = 0; i < s.length - 1; i++) {
        const k = s[i] + '\u0000' + s[i + 1];
        freq.set(k, (freq.get(k) || 0) + 1);
      }
      let best = null, bc = 1;
      for (const [k, c] of freq) if (c > bc) { best = k; bc = c; }
      if (!best) break;
      const [a, b] = best.split('\u0000');
      rules.push({ a, b, count: bc });
      seqs = seqs.map((s) => {
        const out = [];
        for (let i = 0; i < s.length; i++) {
          if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { out.push(a + b); i++; }
          else out.push(s[i]);
        }
        return out;
      });
    }
    return { tokens: seqs.flat(), rules };
  }

  function render() {
    const n = Number(slider.value);
    const { tokens, rules } = train(ta.value, n);
    const showSpace = el.querySelector('.tk-space').checked;
    const vocab = new Map();
    const last = rules.at(-1);
    const lastTok = last ? last.a + last.b : null;
    el.querySelector('.tk-nv').textContent = n;
    el.querySelector('.tk-out').innerHTML = tokens.map((t) => {
      if (!vocab.has(t)) vocab.set(t, vocab.size);
      const shown = showSpace ? t.replace(/ /g, '·') : t;
      return `<span class="tk-tok${t === lastTok ? ' new' : ''}" style="background:${palette(vocab.get(t))}" title="${escapeHtml(JSON.stringify(t))}">${escapeHtml(shown).replace(/\n/g, '↵')}</span>`;
    }).join('');
    const chars = Array.from(ta.value).length;
    el.querySelector('.tk-stat').textContent = `${chars} 字符 → ${tokens.length} 个 token（压缩比 ${(chars / Math.max(tokens.length, 1)).toFixed(2)}）· 实际合并 ${rules.length} 次`;
    el.querySelector('.tk-rules').innerHTML = rules.map((r, i) =>
      `<li class="${i === rules.length - 1 ? 'last' : ''}">${escapeHtml(r.a.replace(/ /g, '·'))} + ${escapeHtml(r.b.replace(/ /g, '·'))} <span class="muted">×${r.count}</span></li>`).join('') || '<span class="muted">（还没有合并）</span>';
  }
  el.addEventListener('input', render);
  render();
}
