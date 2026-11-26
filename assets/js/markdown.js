// Markdown 渲染：在 marked 基础上扩展 数学公式 / 提示框 / 选项卡 / 特殊代码块
// 渲染后的特殊块以占位 <div> 输出，由 components.js 在 DOM 中挂载为交互组件。

const { marked } = window;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const encode = (s) => encodeURIComponent(s);

const CALLOUTS = {
  note: { icon: 'ℹ️', label: '说明' },
  info: { icon: '💡', label: '提示' },
  tip: { icon: '✅', label: '技巧' },
  warning: { icon: '⚠️', label: '注意' },
  danger: { icon: '⛔', label: '警告' },
  example: { icon: '🧪', label: '示例' },
  question: { icon: '❓', label: '思考' },
};

function renderMath(tex, displayMode) {
  try {
    return window.katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch (e) {
    return `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
}

const mathBlock = {
  name: 'mathBlock',
  level: 'block',
  start: (src) => src.match(/^\$\$/m)?.index,
  tokenizer(src) {
    const m = /^\$\$([\s\S]+?)\$\$(?:\n+|$)/.exec(src);
    if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
  },
  renderer: (t) => `<div class="math-display">${renderMath(t.text, true)}</div>\n`,
};

const mathInline = {
  name: 'mathInline',
  level: 'inline',
  start: (src) => src.indexOf('$'),
  tokenizer(src) {
    // $...$ ，要求开头和结尾不是空格，避免误伤 “$5 和 $10”
    const m = /^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
  },
  renderer: (t) => renderMath(t.text, false),
};

// :::type 标题        —— 提示框
// :::tabs ... @tab 名称 ... :::   —— 选项卡
const container = {
  name: 'container',
  level: 'block',
  start: (src) => src.match(/^:::/m)?.index,
  tokenizer(src) {
    const m = /^:::\s*([\w-]+)[ \t]*(.*)\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/.exec(src);
    if (!m) return;
    const [raw, kind, title, body] = m;
    if (kind === 'tabs') {
      const parts = body.split(/^@tab[ \t]+(.*)$/m);
      const tabs = [];
      for (let i = 1; i < parts.length; i += 2) {
        tabs.push({ title: parts[i].trim(), tokens: this.lexer.blockTokens(parts[i + 1].trim()) });
      }
      return { type: 'container', raw, kind, tabs };
    }
    return { type: 'container', raw, kind, title: title.trim(), tokens: this.lexer.blockTokens(body) };
  },
  renderer(t) {
    if (t.kind === 'tabs') {
      const heads = t.tabs.map((tab, i) =>
        `<button class="tab-btn${i ? '' : ' active'}" data-tab="${i}">${escapeHtml(tab.title)}</button>`).join('');
      const panes = t.tabs.map((tab, i) =>
        `<div class="tab-pane${i ? '' : ' active'}" data-tab="${i}">${this.parser.parse(tab.tokens)}</div>`).join('');
      return `<div class="tabs"><div class="tab-head">${heads}</div>${panes}</div>\n`;
    }
    if (t.kind === 'details') {
      return `<details class="fold"><summary>${escapeHtml(t.title || '展开')}</summary>${this.parser.parse(t.tokens)}</details>\n`;
    }
    const c = CALLOUTS[t.kind] || CALLOUTS.note;
    return `<div class="callout callout-${escapeHtml(t.kind)}"><div class="callout-title">${c.icon} ${escapeHtml(t.title || c.label)}</div><div class="callout-body">${this.parser.parse(t.tokens)}</div></div>\n`;
  },
};

// 特殊代码块
//   ```mermaid       流程图/时序图等
//   ```chart         Chart.js 配置（JSON）
//   ```quiz          测验（JSON）
//   ```demo 名称     交互演示（JSON 配置，可空）
//   ```js run        可运行的 JavaScript
const renderer = {
  code(code, info) {
    const [lang = '', ...rest] = (info || '').trim().split(/\s+/);
    const arg = rest.join(' ');
    if (lang === 'mermaid') return `<div class="mermaid-block" data-src="${encode(code)}"></div>`;
    if (lang === 'chart') return `<div class="chart-block" data-config="${encode(code)}"></div>`;
    if (lang === 'quiz') return `<div class="quiz-block" data-config="${encode(code)}"></div>`;
    if (lang === 'demo') return `<div class="demo-block" data-demo="${escapeHtml(arg)}" data-config="${encode(code)}"></div>`;
    if ((lang === 'js' || lang === 'javascript') && arg === 'run')
      return `<div class="demo-block" data-demo="runjs" data-code="${encode(code)}"></div>`;

    let html;
    if (lang && window.hljs?.getLanguage(lang)) html = window.hljs.highlight(code, { language: lang }).value;
    else html = escapeHtml(code);
    const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
    return `<div class="code-wrap">${label}<button class="copy-btn" title="复制">复制</button><pre><code class="hljs">${html}</code></pre></div>`;
  },
  table(header, body) {
    return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  },
};

marked.use({ extensions: [mathBlock, mathInline, container], renderer, gfm: true });

/** 解析 YAML 风格的 front matter（仅支持 key: value 单行） */
export function parseFrontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: src.slice(m[0].length) };
}

export function renderMarkdown(src) {
  return marked.parse(src);
}

export { escapeHtml };
