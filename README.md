# 拼豆图纸生成器

把一张照片转换成 **MARD 色号**的拼豆像素图，并生成可打印的网格图纸与用色清单。
**全程在浏览器本地计算，图片不上传服务器。** 已接入 PWA，可安装到手机主屏幕并离线使用。

- 技术栈：Vue 3 + TypeScript + Vite + Tailwind + Web Worker + Canvas + jsPDF
- 详细设计与交接说明见 [`DESIGN.md`](./DESIGN.md)

## 本地开发

```bash
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # 手机同局域网访问 http://电脑IP:5173

npm test                 # 单元测试
npm run typecheck        # 类型检查
npm run build            # 生产构建，输出 dist/
npm run preview          # 本地预览构建结果（http://localhost:4173）
```

> 要求 Node **>= 20.19**（见 `.nvmrc` / `package.json` 的 `engines`）。
> 不要直接双击 `index.html` 打开（用到 ES 模块 / Web Worker，`file://` 会被浏览器限制）。

## 部署到 Cloudflare Pages

构建命令固定为 `npm run build`，输出目录固定为 `dist`（项目已配好，无需改 `base`）。

### 方式 A：连接 Git 仓库（推荐，push 后自动部署）

1. 把本项目推到 GitHub / GitLab。
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择仓库，构建配置填：
   - **Framework preset**：`Vite`（或 `None`）
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
   - （可选）**环境变量**：`NODE_VERSION = 22`
4. **Save and Deploy**，等构建完成，得到 `https://<项目名>.pages.dev` 地址。
5. 之后每次 `git push` 都会自动重新构建部署。

### 方式 B：直接上传（不用 Git，最省事）

```bash
npm run build
```

然后 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**，
把 `dist/` 文件夹整体拖进去即可。

### 方式 C：Wrangler CLI（一条命令）

```bash
npx wrangler login          # 首次登录
npm run deploy:cf           # 等价于 build 后 wrangler pages deploy dist
```

首次执行会提示创建 Pages 项目（项目名随便取，如 `perler-beads`）。

### 官方文档

- Cloudflare Pages 总览：https://developers.cloudflare.com/pages/
- Vite 框架指南：https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- 直接上传：https://developers.cloudflare.com/pages/get-started/direct-upload/
- Wrangler CLI：https://developers.cloudflare.com/workers/wrangler/

## 手机安装（PWA）

前提：访问的是 **HTTPS** 地址（`*.pages.dev` 自带 HTTPS）。

- **Android（Chrome / Edge）**：打开网址 → 地址栏或菜单出现「安装应用」/「添加到主屏幕」→ 安装。无需 APK。
- **iOS（Safari）**：打开网址 → **分享** → **添加到主屏幕**。

安装后首次打开会缓存全部资源（含导出 PDF 用的分包），之后**断网也能用**。

## 常见问题

- **以后打开还消耗平台额度吗？** 不消耗。离线/再次打开时资源从手机本地缓存读取，不经过平台；只有「首次安装」和「你发布新版本后的自动更新」会走一次网络。
- **发新版后手机怎么更新？** 项目用的是 `autoUpdate`，手机下次联网打开会自动拉取新版本，无需手动清缓存。
- **`dist/index.html` 用的是绝对路径**，所以要部署在域名根目录。Cloudflare Pages 默认就是根目录，无需配置。
- **缓存策略**：`public/_headers` 让带哈希的 `/assets/*` 长期缓存，`sw.js` / `index.html` / `manifest.webmanifest` 每次校验，保证更新及时。
