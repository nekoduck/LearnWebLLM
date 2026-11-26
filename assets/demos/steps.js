// 分步讲解播放器：逐步展示一个过程，可上一步 / 下一步 / 自动播放
// 配置：
// {
//   "title": "...",
//   "interval": 2500,                         // 自动播放间隔（毫秒）
//   "steps": [ { "title": "第一步", "body": "支持 **Markdown** 与 $公式$" }, ... ]
// }
export default function mount(el, cfg, { renderMarkdown, escapeHtml }) {
  const steps = cfg.steps || [];
  if (!steps.length) { el.textContent = '（没有步骤）'; return; }
  let i = 0, timer = null;
  el.innerHTML = `
    <div class="st-dots">${steps.map((s, k) => `<button class="st-dot" data-k="${k}" title="${escapeHtml(s.title || '')}">${k + 1}</button>`).join('<i></i>')}</div>
    <div class="st-card"><div class="st-title"></div><div class="st-body"></div></div>
    <div class="demo-row" style="margin:12px 0 0;justify-content:center">
      <button class="btn small secondary" data-act="prev">← 上一步</button>
      <button class="btn small" data-act="play">▶ 自动播放</button>
      <button class="btn small secondary" data-act="next">下一步 →</button>
    </div>
    <style>
      .st-dots { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0; margin-bottom: 14px; }
      .st-dots i { width: 24px; height: 2px; background: var(--border); }
      .st-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); background: var(--bg); color: var(--fg-muted); font-size: 12px; font-weight: 700; cursor: pointer; }
      .st-dot.past { border-color: var(--primary); color: var(--primary); }
      .st-dot.on { background: var(--primary); border-color: var(--primary); color: #fff; transform: scale(1.12); }
      .st-card { min-height: 120px; padding: 14px 18px; border-radius: 10px; background: var(--bg-soft); animation: stin .35s ease; }
      .st-title { font-weight: 700; font-size: 17px; margin-bottom: 4px; }
      .st-body > :first-child { margin-top: 0; } .st-body > :last-child { margin-bottom: 0; }
      @keyframes stin { from { opacity: 0; transform: translateY(6px); } }
    </style>`;
  const card = el.querySelector('.st-card');
  function go(k) {
    i = (k + steps.length) % steps.length;
    el.querySelectorAll('.st-dot').forEach((d, j) => { d.classList.toggle('on', j === i); d.classList.toggle('past', j < i); });
    el.querySelector('.st-title').textContent = `${i + 1}. ${steps[i].title || ''}`;
    el.querySelector('.st-body').innerHTML = renderMarkdown(steps[i].body || '');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  }
  function stop() { clearInterval(timer); timer = null; el.querySelector('[data-act="play"]').textContent = '▶ 自动播放'; }
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act], .st-dot');
    if (!t) return;
    if (t.dataset.k) { stop(); go(Number(t.dataset.k)); }
    else if (t.dataset.act === 'prev') { stop(); go(i - 1); }
    else if (t.dataset.act === 'next') { stop(); go(i + 1); }
    else if (timer) stop();
    else {
      t.textContent = '⏸ 暂停';
      timer = setInterval(() => (i === steps.length - 1 ? stop() : go(i + 1)), cfg.interval || 2500);
    }
  });
  go(0);
  return stop;
}
