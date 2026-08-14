# BspBuddy 官网落地页

静态营销页，叙事对齐专家系统 + 后台知识库（MCP）+ 桌面 / IDE。

## 本地预览

```bash
npm run website:preview
# 或
npx --yes serve website -l 5173
```

## 打包

产物目录：`website/dist/`；同时生成当日 zip。

```bash
npm run website:pack
# 等价：powershell -File website/pack.ps1
# Linux/macOS：bash website/pack.sh
```

把 `dist/` 整目录丢到任意静态托管即可（Nginx / OSS / Cloudflare Pages / GitHub Pages）。

## Docker 部署

```bash
npm run website:docker
npm run website:docker:run
# 浏览器打开 http://localhost:8080
```

或：

```bash
docker build -t bspbuddy-website:latest website
docker run --rm -d -p 80:80 --name bspbuddy-web bspbuddy-website:latest
```

## 常见托管

| 方式 | 做法 |
|------|------|
| Nginx / Caddy | 指向 `dist/` 或容器 80 端口 |
| Cloudflare Pages / Netlify / Vercel | 上传 `dist/`，或仓库根目录设 Build 输出为 `website/dist`、Publish `website/dist`（无 build 命令也可直接 Publish `website`） |
| 对象存储 + CDN | 上传 `dist/` 为静态网站 |

域名示例：把 DNS 指到 Pages/负载均衡后，根路径即落地页。

## 文件

| 路径 | 说明 |
|------|------|
| `index.html` / `styles.css` | 页面与样式 |
| `assets/` | 设计参考图 |
| `Dockerfile` / `nginx.conf` | 容器部署 |
| `pack.ps1` / `pack.sh` | 打 dist + zip |
| `dist/` | 打包输出（可 gitignore） |

## 产品文档

需求见 [`docs/prd/marketing-001-landing.md`](../docs/prd/marketing-001-landing.md)。
