// 应用入口：路由、目录、课程页、进度
import { parseFrontMatter, renderMarkdown, escapeHtml } from './markdown.js';
import { mountAll } from './components.js';

const $ = (s) => document.querySelector(s);
const main = $('#main'), sidebar = $('#sidebar'), toc = $('#toc'), crumbs = $('#crumbs');
const CONTENT = 'content/';

/* ---------- 存储 ---------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式 */ } },
};
const progress = {
  all: () => store.get('lw-progress', {}),
  has: (c, l) => !!progress.all()[`${c}/${l}`],
  toggle(c, l) {
    const p = progress.all(), k = `${c}/${l}`;
    p[k] ? delete p[k] : (p[k] = Date.now());
    store.set('lw-progress', p);
    return !!p[k];
  },
  count: (course) => course.lessons.filter((l) => progress.has(course.id, l.id)).length,
};

/* ---------- 数据加载 ---------- */
const cache = new Map();
async function fetchText(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const text = await res.text();
  cache.set(path, text);
  return text;
}
const fetchJSON = async (p) => JSON.parse(await fetchText(p));

let catalog;
async function loadCatalog() {
  if (catalog) return catalog;
  const cat = await fetchJSON(CONTENT + 'catalog.json');
  const courses = await Promise.all(cat.courses.map(async (id) => ({ id, ...(await fetchJSON(`${CONTENT}${id}/course.json`)) })));
  catalog = { ...cat, courses };
  if (cat.site?.title) {
    $('#site-title').textContent = cat.site.title;
  }
  return catalog;
}

/* ---------- 视图 ---------- */
let cleanup = () => {};

function setCrumbs(items) {
  crumbs.innerHTML = items.map(([t, href]) => href ? `<a href="${href}">${escapeHtml(t)}</a>` : `<span>${escapeHtml(t)}</span>`).join('<span class="sep">/</span>');
}

function renderHome() {
  document.title = catalog.site?.title || 'LearnWebLLM';
  document.body.classList.add('home');
  sidebar.innerHTML = '';
  toc.innerHTML = '';
  setCrumbs([]);
  const site = catalog.site || {};
  main.innerHTML = `
    <section class="hero">
      <h1>${escapeHtml(site.title || 'LearnWebLLM')}</h1>
      <p>${escapeHtml(site.subtitle || '')}</p>
    </section>
    <section class="course-grid">
      ${catalog.courses.map((c) => {
        const done = progress.count(c), total = c.lessons.length;
        return `
        <a class="course-card" href="#/${c.id}" style="--accent:${escapeHtml(c.color || 'var(--primary)')}">
          <div class="course-icon">${escapeHtml(c.icon || '📘')}</div>
          <h2>${escapeHtml(c.title)}</h2>
          <p>${escapeHtml(c.description || '')}</p>
          <div class="course-meta">
            <span>${total} 节课${c.level ? ' · ' + escapeHtml(c.level) : ''}</span>
            <span>${done ? `已完成 ${done}/${total}` : ''}</span>
          </div>
          <div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
        </a>`;
      }).join('')}
    </section>`;
}

function renderSidebar(course, lessonId) {
  const done = progress.count(course);
  sidebar.innerHTML = `
    <div class="side-course">
      <a href="#/${course.id}" class="side-title">${escapeHtml(course.icon || '📘')} ${escapeHtml(course.title)}</a>
      <div class="bar"><i style="width:${(done / course.lessons.length) * 100}%"></i></div>
      <div class="muted small">已完成 ${done} / ${course.lessons.length}</div>
    </div>
    <ol class="side-lessons">
      ${course.lessons.map((l, i) => `
        <li class="${l.id === lessonId ? 'active' : ''} ${progress.has(course.id, l.id) ? 'done' : ''}">
          <a href="#/${course.id}/${l.id}"><span class="num">${progress.has(course.id, l.id) ? '✓' : i + 1}</span><span>${escapeHtml(l.title)}</span></a>
        </li>`).join('')}
    </ol>`;
}

function renderCourse(course) {
  document.title = `${course.title} · ${catalog.site?.title || ''}`;
  renderSidebar(course, null);
  toc.innerHTML = '';
  setCrumbs([[course.title]]);
  const first = course.lessons.find((l) => !progress.has(course.id, l.id)) || course.lessons[0];
  main.innerHTML = `
    <article class="course-intro">
      <div class="course-icon big">${escapeHtml(course.icon || '📘')}</div>
      <h1>${escapeHtml(course.title)}</h1>
      <p class="lead">${escapeHtml(course.description || '')}</p>
      ${first ? `<a class="btn" href="#/${course.id}/${first.id}">${progress.count(course) ? '继续学习' : '开始学习'} →</a>` : ''}
      <ol class="lesson-list">
        ${course.lessons.map((l, i) => `
          <li><a href="#/${course.id}/${l.id}">
            <span class="num">${progress.has(course.id, l.id) ? '✓' : i + 1}</span>
            <span><b>${escapeHtml(l.title)}</b>${l.summary ? `<br><span class="muted">${escapeHtml(l.summary)}</span>` : ''}</span>
            ${l.duration ? `<span class="muted small">${escapeHtml(l.duration)}</span>` : ''}
          </a></li>`).join('')}
      </ol>
    </article>`;
}

function slugify(text, used) {
  let s = text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
  let k = s, n = 1;
  while (used.has(k)) k = `${s}-${++n}`;
  used.add(k);
  return k;
}

// 修正 Markdown 中的相对路径：图片 -> content/<课程>/...，*.md 链接 -> 站内路由
function fixLinks(root, course) {
  const base = `${CONTENT}${course.id}/`;
  const isRel = (u) => u && !/^([a-z]+:|\/|#|data:)/i.test(u);
  root.querySelectorAll('img[src], video[src], source[src], audio[src], iframe[src]').forEach((el) => {
    const u = el.getAttribute('src');
    if (isRel(u)) el.setAttribute('src', base + u);
  });
  root.querySelectorAll('a[href]').forEach((a) => {
    const u = a.getAttribute('href');
    if (!isRel(u)) {
      if (/^https?:/.test(u)) { a.target = '_blank'; a.rel = 'noopener'; }
      return;
    }
    const m = /^(?:\.\.\/([\w-]+)\/)?([\w-]+)\.md(#.*)?$/.exec(u);
    if (m) a.setAttribute('href', `#/${m[1] || course.id}/${m[2]}${m[3] ? '?' + m[3].slice(1) : ''}`);
    else a.setAttribute('href', base + u);
  });
}

function buildToc(article) {
  const used = new Set();
  const heads = [...article.querySelectorAll('h2, h3')];
  heads.forEach((h) => (h.id = slugify(h.textContent, used)));
  if (heads.length < 2) { toc.innerHTML = ''; return; }
  toc.innerHTML = `<div class="toc-title">本节目录</div>` + heads.map((h) =>
    `<a class="toc-${h.tagName.toLowerCase()}" data-id="${h.id}">${escapeHtml(h.textContent)}</a>`).join('');
  toc.onclick = (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) document.getElementById(a.dataset.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // 滚动高亮
  const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.dataset.id, a]));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.classList.remove('active'));
        links.get(en.target.id)?.classList.add('active');
      }
    });
  }, { rootMargin: '-70px 0px -70% 0px' });
  heads.forEach((h) => obs.observe(h));
  return () => obs.disconnect();
}

async function renderLesson(course, lessonId, anchor) {
  const idx = course.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return renderNotFound(`课程「${course.title}」中没有这一节：${lessonId}`);
  const lesson = course.lessons[idx];
  renderSidebar(course, lessonId);
  setCrumbs([[course.title, `#/${course.id}`], [lesson.title]]);
  main.innerHTML = '<div class="loading">加载中…</div>';

  const src = await fetchText(`${CONTENT}${course.id}/${lesson.file || lesson.id + '.md'}`);
  const { meta, body } = parseFrontMatter(src);
  const title = meta.title || lesson.title;
  document.title = `${title} · ${course.title}`;
  const prev = course.lessons[idx - 1], next = course.lessons[idx + 1];
  const done = progress.has(course.id, lessonId);

  main.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <div class="muted small">第 ${idx + 1} 节 / 共 ${course.lessons.length} 节${meta.duration || lesson.duration ? ' · ⏱ ' + escapeHtml(meta.duration || lesson.duration) : ''}</div>
        <h1>${escapeHtml(title)}</h1>
        ${meta.summary || lesson.summary ? `<p class="lead">${escapeHtml(meta.summary || lesson.summary)}</p>` : ''}
      </header>
      <div class="prose">${renderMarkdown(body)}</div>
      <footer class="lesson-foot">
        <button class="btn ${done ? 'ghost' : ''}" id="done-btn">${done ? '✓ 已完成（点击取消）' : '标记为已完成'}</button>
        <div class="pager">
          ${prev ? `<a class="pager-link" href="#/${course.id}/${prev.id}"><small>← 上一节</small><span>${escapeHtml(prev.title)}</span></a>` : '<span></span>'}
          ${next ? `<a class="pager-link next" href="#/${course.id}/${next.id}"><small>下一节 →</small><span>${escapeHtml(next.title)}</span></a>` : '<span></span>'}
        </div>
      </footer>
    </article>`;

  const prose = main.querySelector('.prose');
  fixLinks(prose, course);
  const tocCleanup = buildToc(prose);
  $('#done-btn').onclick = () => {
    const now = progress.toggle(course.id, lessonId);
    if (now && next) location.hash = `#/${course.id}/${next.id}`;
    else route();
  };
  const compCleanup = await mountAll(prose);
  if (anchor) document.getElementById(anchor)?.scrollIntoView();
  return () => { tocCleanup?.(); compCleanup(); };
}

function renderNotFound(msg) {
  sidebar.innerHTML = toc.innerHTML = '';
  main.innerHTML = `<div class="empty"><h1>😵 找不到页面</h1><p>${escapeHtml(msg)}</p><a class="btn" href="#/">返回首页</a></div>`;
}

/* ---------- 路由：#/课程/课节?锚点 ---------- */
let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  cleanup();
  cleanup = () => {};
  document.body.classList.remove('home', 'menu-open');
  const [path, anchor] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('?');
  const [courseId, lessonId] = path.split('/').filter(Boolean);
  try {
    await loadCatalog();
    if (seq !== routeSeq) return;
    if (!courseId) renderHome();
    else {
      const course = catalog.courses.find((c) => c.id === courseId);
      if (!course) renderNotFound(`没有找到课程：${courseId}`);
      else if (!lessonId) renderCourse(course);
      else {
        const c = await renderLesson(course, lessonId, anchor);
        if (seq !== routeSeq) return c?.();
        if (c) cleanup = c;
      }
    }
    if (!anchor) window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><h1>加载出错</h1><p>${escapeHtml(e.message)}</p></div>`;
  }
}

/* ---------- 主题与移动端菜单 ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#hljs-light').disabled = t === 'dark';
  $('#hljs-dark').disabled = t !== 'dark';
}
applyTheme(document.documentElement.dataset.theme);
$('#theme-btn').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('lw-theme', t); } catch { /* ignore */ }
  applyTheme(t);
  route(); // 图表 / 流程图按新主题重绘
};
$('#menu-btn').onclick = () => document.body.classList.toggle('menu-open');
$('#scrim').onclick = () => document.body.classList.remove('menu-open');

window.addEventListener('hashchange', route);
route();
