// 温度 / Top-k / Top-p 采样演示
// 配置：
// {
//   "title": "标题",
//   "prompt": "今天天气真",
//   "candidates": { "好": 4.2, "不错": 3.1, ... },   // token -> logit
//   "temperature": 1, "topK": 0, "topP": 1,          // 初始值（0 表示不限制）
//   "controls": ["temperature", "topK", "topP"]      // 显示哪些滑块
// }
export default function mount(el, cfg, { escapeHtml }) {
  const cands = Object.entries(cfg.candidates || { 好: 4, 不错: 3.2, 晴朗: 2.6, 糟糕: 1.5, 热: 1.2, 冷: 0.8, 蓝: 0.1 });
  const controls = cfg.controls || ['temperature', 'topK', 'topP'];
  const state = { T: cfg.temperature ?? 1, k: cfg.topK ?? 0, p: cfg.topP ?? 1, counts: {}, total: 0 };

  el.innerHTML = `
    ${cfg.prompt ? `<div class="sm-prompt">输入：<b>${escapeHtml(cfg.prompt)}</b><span class="sm-out"></span><span class="sm-cursor">▌</span></div>` : ''}
    <div class="demo-row">
      ${controls.includes('temperature') ? `<label>温度 T <input type="range" data-k="T" min="0.05" max="3" step="0.05" value="${state.T}"><span class="val" data-v="T"></span></label>` : ''}
      ${controls.includes('topK') ? `<label>Top-k <input type="range" data-k="k" min="0" max="${cands.length}" step="1" value="${state.k}"><span class="val" data-v="k"></span></label>` : ''}
      ${controls.includes('topP') ? `<label>Top-p <input type="range" data-k="p" min="0.05" max="1" step="0.05" value="${state.p}"><span class="val" data-v="p"></span></label>` : ''}
    </div>
    <div class="sm-bars"></div>
    <div class="demo-row" style="margin-top:12px">
      <button class="btn small" data-act="one">🎲 采样一次</button>
      <button class="btn small secondary" data-act="many">采样 100 次</button>
      <button class="btn small secondary" data-act="reset">重置</button>
      <span class="muted small sm-stat"></span>
    </div>
    <style>
      .sm-prompt { font-size: 18px; margin-bottom: 12px; padding: 10px 14px; background: var(--bg-soft); border-radius: 8px; }
      .sm-out { color: var(--primary); font-weight: 700; }
      .sm-cursor { animation: smblink 1s steps(1) infinite; color: var(--primary); }
      @keyframes smblink { 50% { opacity: 0; } }
      .sm-bar { display: grid; grid-template-columns: 64px 1fr 120px; gap: 10px; align-items: center; margin: 6px 0; font-size: 14px; }
      .sm-tok { font-weight: 700; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sm-track { height: 22px; background: var(--bg-soft); border-radius: 6px; overflow: hidden; position: relative; }
      .sm-fill { height: 100%; background: linear-gradient(90deg, var(--primary), #b06cf7); border-radius: 6px; transition: width .35s ease; }
      .sm-hit { position: absolute; top: 0; left: 0; height: 100%; border-right: 2px dashed var(--warn); transition: width .35s; }
      .sm-bar.cut { opacity: .35; }
      .sm-bar.flash .sm-track { outline: 2px solid var(--warn); }
      .sm-num { font-family: var(--mono); font-size: 13px; color: var(--fg-muted); }
    </style>`;

  const bars = el.querySelector('.sm-bars');
  bars.innerHTML = cands.map(([t], i) => `
    <div class="sm-bar" data-i="${i}">
      <span class="sm-tok">${escapeHtml(t)}</span>
      <div class="sm-track"><div class="sm-fill"></div><div class="sm-hit"></div></div>
      <span class="sm-num"></span>
    </div>`).join('');

  function probs() {
    const logits = cands.map(([, l]) => l / state.T);
    const m = Math.max(...logits);
    let p = logits.map((l) => Math.exp(l - m));
    let s = p.reduce((a, b) => a + b, 0);
    p = p.map((x) => x / s);
    const order = p.map((x, i) => i).sort((a, b) => p[b] - p[a]);
    const keep = new Set();
    let cum = 0;
    for (const [rank, i] of order.entries()) {
      if (state.k && rank >= state.k) break;
      if (cum >= state.p - 1e-9) break;
      keep.add(i);
      cum += p[i];
    }
    const raw = p.slice();
    s = p.reduce((a, x, i) => a + (keep.has(i) ? x : 0), 0);
    p = p.map((x, i) => (keep.has(i) ? x / s : 0));
    return { p, raw, keep };
  }

  function render(flash = -1) {
    el.querySelector('[data-v="T"]')?.replaceChildren(state.T.toFixed(2));
    el.querySelector('[data-v="k"]')?.replaceChildren(state.k ? String(state.k) : '不限');
    el.querySelector('[data-v="p"]')?.replaceChildren(state.p.toFixed(2));
    const { p, keep } = probs();
    bars.querySelectorAll('.sm-bar').forEach((b, i) => {
      b.querySelector('.sm-fill').style.width = (p[i] * 100).toFixed(1) + '%';
      const freq = state.total ? (state.counts[i] || 0) / state.total : 0;
      b.querySelector('.sm-hit').style.width = state.total ? (freq * 100).toFixed(1) + '%' : '0';
      b.querySelector('.sm-num').textContent = `${(p[i] * 100).toFixed(1)}%` + (state.total ? ` · 实测 ${(freq * 100).toFixed(0)}%` : '');
      b.classList.toggle('cut', !keep.has(i));
      b.classList.toggle('flash', i === flash);
    });
    el.querySelector('.sm-stat').textContent = state.total ? `已采样 ${state.total} 次（虚线 = 实际频率）` : '';
  }

  function sample() {
    const { p } = probs();
    let r = Math.random(), i = 0;
    for (; i < p.length - 1; i++) { r -= p[i]; if (r <= 0) break; }
    while (p[i] === 0 && i > 0) i--;
    state.counts[i] = (state.counts[i] || 0) + 1;
    state.total++;
    return i;
  }

  el.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    state[k] = Number(e.target.value);
    state.counts = {}; state.total = 0;
    render();
  });
  el.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (act === 'one') {
      const i = sample();
      const out = el.querySelector('.sm-out');
      if (out) out.textContent = cands[i][0];
      render(i);
    } else if (act === 'many') {
      for (let n = 0; n < 100; n++) sample();
      render();
    } else if (act === 'reset') {
      state.counts = {}; state.total = 0;
      const out = el.querySelector('.sm-out');
      if (out) out.textContent = '';
      render();
    }
  });
  render();
}
