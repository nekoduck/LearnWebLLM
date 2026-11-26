# LearnWebLLM

交互式大模型学习站。**纯静态、零构建**，可直接部署在 GitHub Pages。

- 课程内容 = Markdown 文件
- 支持：公式（KaTeX）、流程图（Mermaid）、数据图表（Chart.js）、测验、选项卡、提示框、可运行代码、交互 Demo
- 明暗主题、移动端适配、课节目录、学习进度（本地保存）
- 第三方库全部内置在 `assets/vendor/`，不依赖外部 CDN

## 目录结构

```
index.html                 入口（单页应用，hash 路由 #/<课程>/<课节>）
content/                   ← 所有课程内容都在这里
  catalog.json             站点标题 & 课程列表
  <课程ID>/
    course.json            课程信息与课节顺序
    <课节ID>.md            课节正文
    images/                课程用到的图片（可选）
assets/
  js/app.js                路由、页面、进度
  js/markdown.js           Markdown 扩展（公式 / 提示框 / 选项卡 / 特殊代码块）
  js/components.js         挂载流程图、图表、测验、Demo
  demos/<名称>.js          交互 Demo，一个文件一个
  css/style.css            样式（CSS 变量主题）
  vendor/                  第三方库
```

## 添加内容

1. 在 `content/catalog.json` 的 `courses` 中加入课程 ID
2. 新建 `content/<课程ID>/course.json`：

```json
{
  "title": "课程标题",
  "description": "一句话介绍",
  "icon": "🤖",
  "color": "#4f6ef7",
  "level": "入门",
  "lessons": [
    { "id": "01-intro", "title": "课节标题", "summary": "可选", "duration": "10 分钟" }
  ]
}
```

3. 新建 `content/<课程ID>/01-intro.md` 编写正文（可选 front matter：`title` / `summary` / `duration`）

所有组件写法见站内课程 **「内容写作指南 → 组件一览」**（源文件 `content/guide/components.md`）。

速查：

| 语法 | 效果 |
| --- | --- |
| `$...$` / `$$...$$` | 公式 |
| `:::tip 标题` … `:::` | 提示框（note / info / tip / warning / danger / example / question） |
| `:::details 标题` … `:::` | 折叠块 |
| `:::tabs` + `@tab 名称` … `:::` | 选项卡 |
| ```` ```mermaid ```` | 流程图 / 时序图 / 思维导图等 |
| ```` ```chart ```` | Chart.js 图表（JSON 配置） |
| ```` ```quiz ```` | 测验（JSON） |
| ```` ```demo 名称 ```` | 交互 Demo（JSON 配置） |
| ```` ```js run ```` | 可运行的 JavaScript |

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

（不能直接双击 `index.html` 用 `file://` 打开，因为内容是通过 fetch 加载的。）

## 部署到 GitHub Pages

仓库 **Settings → Pages → Build and deployment**：

- Source：`Deploy from a branch`
- Branch：选择站点所在分支，目录选 `/ (root)`

保存后等待约 1 分钟，访问 `https://<用户名>.github.io/LearnWebLLM/`。
