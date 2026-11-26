// 可运行的 JavaScript 代码块：在 Markdown 中写 ```js run 即可
// 代码在页面中直接执行（仅用于教学示例），console.log 输出显示在下方
export default function mount(el, cfg) {
  const initial = cfg.code || 'console.log("Hello, LLM!")';
  el.innerHTML = `
    <div class="rj-bar"><span class="pill">JavaScript · 可编辑</span><span style="flex:1"></span>
      <button class="btn small secondary" data-act="reset">还原</button>
      <button class="btn small" data-act="run">▶ 运行</button></div>
    <textarea class="rj-code" spellcheck="false"></textarea>
    <pre class="rj-out"><span class="muted">点击「运行」查看输出（Ctrl/⌘ + Enter）</span></pre>
    <style>
      .demo-runjs .demo-body { padding: 0; }
      .rj-bar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border); }
      .demo-body textarea.rj-code { border: 0; border-radius: 0; min-height: 60px; font-size: 14px; line-height: 1.6; padding: 12px 16px; background: var(--bg-soft); tab-size: 2; display: block; }
      .rj-out { margin: 0; padding: 10px 16px; font: 13px/1.6 var(--mono); max-height: 260px; overflow: auto; border-top: 1px solid var(--border); white-space: pre-wrap; }
      .rj-err { color: var(--bad); }
    </style>`;
  const ta = el.querySelector('.rj-code'), out = el.querySelector('.rj-out');
  const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 4 + 'px'; };
  ta.value = initial;
  requestAnimationFrame(fit);
  const fmt = (v) => {
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toFixed(4) : x)); } catch { return String(v); }
  };
  async function run() {
    out.innerHTML = '';
    const log = (cls) => (...args) => {
      const line = document.createElement('div');
      if (cls) line.className = cls;
      line.textContent = args.map(fmt).join(' ');
      out.appendChild(line);
    };
    const fakeConsole = { log: log(), info: log(), warn: log(), error: log('rj-err'), table: log() };
    try {
      const fn = new Function('console', `return (async () => {\n${ta.value}\n})()`);
      const r = await fn(fakeConsole);
      if (r !== undefined) log('muted')('← ' + fmt(r));
      if (!out.childNodes.length) out.innerHTML = '<span class="muted">（无输出）</span>';
    } catch (e) {
      log('rj-err')(`${e.name}: ${e.message}`);
    }
  }
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); }
  });
  el.addEventListener('click', (e) => {
    if (e.target.dataset.act === 'run') run();
    if (e.target.dataset.act === 'reset') { ta.value = initial; fit(); out.innerHTML = ''; }
  });
}
