// 在已渲染的课程 DOM 中挂载交互组件
import { renderMarkdown, escapeHtml } from './markdown.js';

const scriptCache = {};
export function loadScript(src) {
  return (scriptCache[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('加载失败: ' + src));
    document.head.appendChild(s);
  }));
}

const isDark = () => document.documentElement.dataset.theme === 'dark';
const parseJSON = (text, el) => {
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch (e) {
    el.innerHTML = `<div class="block-error">配置 JSON 解析失败：${escapeHtml(e.message)}</div>`;
    return null;
  }
};

/* ---------- Mermaid ---------- */
let mermaidSeq = 0;
async function mountMermaid(blocks) {
  if (!blocks.length) return;
  await loadScript('assets/vendor/mermaid.min.js');
  window.mermaid.initialize({
    startOnLoad: false,
    theme: isDark() ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'inherit',
  });
  for (const el of blocks) {
    const src = decodeURIComponent(el.dataset.src);
    try {
      const { svg } = await window.mermaid.render(`mmd-${++mermaidSeq}`, src);
      el.innerHTML = svg;
    } catch (e) {
      el.innerHTML = `<div class="block-error">Mermaid 语法错误：${escapeHtml(e.message || e)}</div><pre>${escapeHtml(src)}</pre>`;
    }
  }
}

/* ---------- Chart.js ---------- */
async function mountCharts(blocks, cleanups) {
  if (!blocks.length) return;
  await loadScript('assets/vendor/chart.umd.js');
  const Chart = window.Chart;
  Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--fg-muted').trim();
  Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  for (const el of blocks) {
    const cfg = parseJSON(decodeURIComponent(el.dataset.config), el);
    if (!cfg) continue;
    const { height = 300, caption, ...chartCfg } = cfg;
    el.innerHTML = `<div class="chart-box" style="height:${Number(height)}px"><canvas></canvas></div>${caption ? `<div class="caption">${escapeHtml(caption)}</div>` : ''}`;
    chartCfg.options = { responsive: true, maintainAspectRatio: false, ...(chartCfg.options || {}) };
    const chart = new Chart(el.querySelector('canvas'), chartCfg);
    cleanups.push(() => chart.destroy());
  }
}

/* ---------- 测验 ---------- */
function mountQuiz(el) {
  const cfg = parseJSON(decodeURIComponent(el.dataset.config), el);
  if (!cfg) return;
  const questions = Array.isArray(cfg) ? cfg : cfg.questions || [cfg];
  el.innerHTML = `<div class="quiz-head">📝 小测验 <span class="quiz-score"></span></div>`;
  let correct = 0;
  const score = el.querySelector('.quiz-score');
  questions.forEach((q, qi) => {
    const multi = Array.isArray(q.answer);
    const answers = multi ? q.answer : [q.answer];
    const box = document.createElement('div');
    box.className = 'quiz-q';
    box.innerHTML = `
      <div class="quiz-question">${questions.length > 1 ? `<b>${qi + 1}.</b> ` : ''}${renderMarkdown(q.question).replace(/^<p>|<\/p>\s*$/g, '')}${multi ? ' <span class="muted">（多选）</span>' : ''}</div>
      <div class="quiz-options">${q.options.map((o, i) =>
        `<button class="quiz-opt" data-i="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${renderMarkdown(String(o)).replace(/^<p>|<\/p>\s*$/g, '')}</span></button>`).join('')}</div>
      ${multi ? '<button class="btn small quiz-submit">提交</button>' : ''}
      <div class="quiz-explain" hidden></div>`;
    const opts = [...box.querySelectorAll('.quiz-opt')];
    const picked = new Set();
    let done = false;
    const finish = () => {
      done = true;
      const ok = picked.size === answers.length && answers.every((a) => picked.has(a));
      if (ok) correct++;
      opts.forEach((b, i) => {
        b.disabled = true;
        if (answers.includes(i)) b.classList.add('correct');
        else if (picked.has(i)) b.classList.add('wrong');
      });
      const ex = box.querySelector('.quiz-explain');
      ex.hidden = false;
      ex.innerHTML = `<b>${ok ? '✅ 回答正确！' : '❌ 再想想～'}</b> ${q.explain ? renderMarkdown(q.explain) : ''}`;
      score.textContent = `${correct} / ${questions.length}`;
    };
    opts.forEach((b, i) =>
      b.addEventListener('click', () => {
        if (done) return;
        if (!multi) { picked.add(i); return finish(); }
        picked.has(i) ? picked.delete(i) : picked.add(i);
        b.classList.toggle('picked');
      }));
    box.querySelector('.quiz-submit')?.addEventListener('click', () => !done && picked.size && finish());
    el.appendChild(box);
  });
}

/* ---------- 交互 Demo（assets/demos/<名称>.js） ---------- */
async function mountDemo(el, cleanups) {
  const name = el.dataset.demo;
  if (!/^[\w-]+$/.test(name || '')) {
    el.innerHTML = `<div class="block-error">无效的 demo 名称：${escapeHtml(name || '(空)')}</div>`;
    return;
  }
  let cfg = {};
  if (el.dataset.config !== undefined) {
    cfg = parseJSON(decodeURIComponent(el.dataset.config), el);
    if (!cfg) return;
  }
  if (el.dataset.code !== undefined) cfg.code = decodeURIComponent(el.dataset.code);
  el.innerHTML = '<div class="demo-loading">演示加载中…</div>';
  try {
    const mod = await import(`../demos/${name}.js`);
    el.innerHTML = '';
    el.classList.add(`demo-${name}`);
    if (cfg.title) {
      const h = document.createElement('div');
      h.className = 'demo-title';
      h.innerHTML = `🎛️ ${escapeHtml(cfg.title)}`;
      el.appendChild(h);
    }
    const body = document.createElement('div');
    body.className = 'demo-body';
    el.appendChild(body);
    const cleanup = await mod.default(body, cfg, { renderMarkdown, escapeHtml, loadScript, isDark });
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="block-error">Demo「${escapeHtml(name)}」加载失败：${escapeHtml(e.message)}</div>`;
  }
}

/* ---------- 选项卡 / 复制按钮 ---------- */
function mountTabs(root) {
  root.querySelectorAll('.tabs').forEach((tabs) => {
    tabs.querySelector('.tab-head').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      const i = btn.dataset.tab;
      tabs.querySelectorAll(':scope > .tab-head > .tab-btn, :scope > .tab-pane').forEach((x) =>
        x.classList.toggle('active', x.dataset.tab === i));
    });
  });
}
function mountCopy(root) {
  root.querySelectorAll('.copy-btn').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code').innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '已复制';
      } catch {
        btn.textContent = '复制失败';
      }
      setTimeout(() => (btn.textContent = '复制'), 1500);
    }));
}

/** 挂载 root 下的所有组件，返回清理函数 */
export async function mountAll(root) {
  const cleanups = [];
  mountTabs(root);
  mountCopy(root);
  root.querySelectorAll('.quiz-block').forEach(mountQuiz);
  await Promise.all([
    mountMermaid([...root.querySelectorAll('.mermaid-block')]),
    mountCharts([...root.querySelectorAll('.chart-block')], cleanups),
    ...[...root.querySelectorAll('.demo-block')].map((el) => mountDemo(el, cleanups)),
  ]).catch((e) => console.error(e));
  return () => cleanups.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
}
