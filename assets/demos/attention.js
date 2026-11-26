// 注意力可视化：点击/悬停某个 token，查看它对其他 token 的注意力权重
// 配置：
// {
//   "title": "...",
//   "tokens": ["小猫", "坐", "在", ...],
//   "weights": [[...], ...],       // 可选：N×N 注意力矩阵（每行一个 query）
//   "links": [["它", "小猫", 3]],  // 可选：不给 weights 时，用 “query, key, 强度” 自动生成矩阵
//   "causal": false,               // 初始是否启用因果遮罩
//   "focus": "它"                  // 初始选中的 token
// }
export default function mount(el, cfg, { escapeHtml }) {
  const tokens = cfg.tokens || ['小猫', '坐', '在', '垫子', '上', '，', '因为', '它', '很', '累'];
  const n = tokens.length;
  let W = cfg.weights;
  if (!W) {
    const boost = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const [q, k, s] of cfg.links || [['它', '小猫', 3.5], ['累', '小猫', 2], ['坐', '小猫', 2], ['上', '垫子', 2.5]]) {
      const qi = tokens.indexOf(q), ki = tokens.indexOf(k);
      if (qi >= 0 && ki >= 0) boost[qi][ki] += s;
    }
    W = tokens.map((_, i) => tokens.map((_, j) => 1.2 * (i === j) + 1 / (1 + Math.abs(i - j)) + boost[i][j]));
    W = W.map((row) => row.map((x) => Math.exp(x))); // 后面统一归一化
  }
  const state = { focus: Math.max(0, tokens.indexOf(cfg.focus ?? '它')), causal: !!cfg.causal, pinned: true };

  el.innerHTML = `
    <div class="demo-row">
      <label><input type="checkbox" class="at-causal" ${state.causal ? 'checked' : ''}> 因果遮罩（只能看见左边）</label>
      <span class="muted small">提示：点击或悬停上方的词</span>
    </div>
    <div class="at-stage">
      <svg class="at-svg"></svg>
      <div class="at-row at-q">${tokens.map((t, i) => `<span class="at-tok" data-i="${i}">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="at-row at-k">${tokens.map((t, i) => `<span class="at-tok" data-i="${i}">${escapeHtml(t)}</span>`).join('')}</div>
    </div>
    <div class="at-grid-wrap"><table class="at-grid"></table></div>
    <style>
      .at-stage { position: relative; padding: 4px 0; }
      .at-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
      .at-row { display: flex; justify-content: space-around; gap: 4px; position: relative; }
      .at-k { margin-top: 90px; }
      .at-tok { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); font-size: 15px; cursor: pointer; white-space: nowrap; transition: background .2s; }
      .at-q .at-tok.on { background: var(--primary); color: #fff; border-color: var(--primary); }
      .at-k .at-tok { background: rgba(123,147,255, var(--a, 0)); }
      .at-k .at-tok.masked { opacity: .3; text-decoration: line-through; }
      .at-grid-wrap { overflow-x: auto; margin-top: 18px; }
      .at-grid { border-collapse: collapse; margin: 0 auto; font-size: 12px; }
      .at-grid td, .at-grid th { width: 38px; height: 26px; text-align: center; padding: 0; font-weight: 400; }
      .at-grid th { color: var(--fg-muted); white-space: nowrap; padding: 0 4px; }
      .at-grid td { font-family: var(--mono); font-size: 11px; cursor: pointer; border: 1px solid var(--bg-elev); }
      .at-grid tr.on th { color: var(--primary); font-weight: 700; }
      .at-grid tr.on td { outline: 1px solid var(--primary); }
    </style>`;

  const svg = el.querySelector('.at-svg');
  const qs = [...el.querySelectorAll('.at-q .at-tok')], ks = [...el.querySelectorAll('.at-k .at-tok')];

  function matrix() {
    return W.map((row, i) => {
      const r = row.map((x, j) => (state.causal && j > i ? 0 : x));
      const s = r.reduce((a, b) => a + b, 0) || 1;
      return r.map((x) => x / s);
    });
  }

  function render() {
    const M = matrix();
    const f = state.focus;
    qs.forEach((q, i) => q.classList.toggle('on', i === f));
    const rect = el.querySelector('.at-stage').getBoundingClientRect();
    let paths = '';
    ks.forEach((k, j) => {
      const w = M[f][j];
      k.style.setProperty('--a', Math.min(1, w * 1.6).toFixed(3));
      k.classList.toggle('masked', state.causal && j > f);
      if (w < 0.005) return;
      const a = qs[f].getBoundingClientRect(), b = k.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - rect.left, y1 = a.bottom - rect.top;
      const x2 = b.left + b.width / 2 - rect.left, y2 = b.top - rect.top;
      const my = (y1 + y2) / 2;
      paths += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" stroke="var(--primary)" stroke-opacity="${Math.min(1, 0.15 + w * 1.5)}" stroke-width="${1 + w * 14}" fill="none" stroke-linecap="round"/>`;
      if (w > 0.08) paths += `<text x="${x2}" y="${y2 - 6}" text-anchor="middle" font-size="11" fill="var(--fg-muted)">${(w * 100).toFixed(0)}%</text>`;
    });
    svg.innerHTML = paths;

    el.querySelector('.at-grid').innerHTML =
      `<tr><th></th>${tokens.map((t) => `<th>${escapeHtml(t)}</th>`).join('')}</tr>` +
      M.map((row, i) => `<tr class="${i === f ? 'on' : ''}" data-i="${i}"><th>${escapeHtml(tokens[i])}</th>${row.map((w) =>
        `<td data-i="${i}" style="background:rgba(123,147,255,${Math.min(1, w * 1.6).toFixed(3)});color:${w > 0.35 ? '#fff' : 'var(--fg-muted)'}">${w >= 0.01 ? (w * 100).toFixed(0) : ''}</td>`).join('')}</tr>`).join('');
  }

  el.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.at-q .at-tok, .at-grid td');
    if (t) { state.focus = Number(t.dataset.i); render(); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('.at-tok, .at-grid td, .at-grid tr[data-i] th');
    if (t) { state.focus = Number(t.dataset.i ?? t.parentElement.dataset.i); render(); }
  });
  el.querySelector('.at-causal').addEventListener('change', (e) => { state.causal = e.target.checked; render(); });
  const ro = new ResizeObserver(() => render());
  ro.observe(el);
  render();
  return () => ro.disconnect();
}
