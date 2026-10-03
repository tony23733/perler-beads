# 拼豆图纸生成器 — 设计文档

> 状态：**第二阶段进行中** —— 第一阶段 MVP 已验收。
> 已完成：限制颜色数量、抖动（Floyd–Steinberg / Bayer 有序）、网格行列坐标、背景处理（保留 / 透明 / 按颜色去除）。
> 下一步建议：**分页 A4 PDF** → 保存/加载工程 → 撤销/重做 → PWA。
> 目标：把一张照片转换成 MARD 色号的拼豆像素图，并绘制可打印的网格图纸。
> 定位：**第一阶段纯本地使用**（浏览器打开即用，无服务器、无 PWA）。功能成熟后再考虑部署与打包。

---

## 1. 项目目标

- 输入：任意照片（JPG / PNG / WEBP，手机相册、拖拽或相机拍摄）。
- 输出：按 MARD 色卡像素化的拼豆图 + 可打印网格图纸 + 用色清单。
- 形态（第一阶段）：
  - 电脑：本地起一个静态页面，浏览器打开使用。
  - 手机：同一局域网下用浏览器打开即可（核心功能可用）。
- 隐私：**全程在浏览器本地计算，图片不上传服务器。**

### 1.1 阶段划分

| 阶段 | 内容 | 是否需要服务器/HTTPS |
|---|---|---|
| **第一阶段（当前）** | 纯本地静态网页工具，功能打磨 | 否 |
| 第二阶段 | 可安装 PWA、离线、部署到静态托管、分页 PDF 等 | 静态托管（可选 HTTPS），仍无后端 |
| 第三阶段（可选） | Tauri 桌面安装包、云同步 | 桌面无需；云同步才需要后端 |

> 结论：**第一阶段完全不需要服务器**。整个应用是纯前端计算。
> 唯一注意：不能直接双击 `index.html` 打开（用到 ES 模块 / Web Worker，`file://` 会被浏览器限制），需要本地静态服务。

---

## 2. 技术选型

| 部分 | 选型 | 说明 |
|---|---|---|
| 语言 | TypeScript **5.9**（注意：不要升 TS 7） | TS 7 为 Go 重写版，`vue-tsc` 尚不兼容，故锁定 5.9.x |
| 构建 | Vite | 快，输出纯静态文件 |
| 框架 | **Vue 3** | `<script setup>` 省代码、运行时小、与 Vite/Tailwind 配合简单 |
| 样式 | Tailwind CSS | 快速搭建界面 |
| 图像处理 | Canvas 2D API | 读取像素、缩放、生成图 |
| 重型计算 | Web Worker | 颜色匹配不阻塞界面 |
| 颜色匹配 | CIELAB + CIEDE2000 色差 | 比 RGB 欧氏距离更接近人眼 |
| 导出 | Canvas PNG / SVG / jsPDF | 图纸、清单（PDF 属第二阶段） |
| PWA | ~~vite-plugin-pwa~~ | **推迟到第二阶段** |
| 桌面封装 | ~~Tauri~~ | **推迟到第三阶段，可选** |

**不使用**：Node/Python 后端、数据库、对象存储。图片不上传，全部本地计算。

> 备选方案：纯静态 HTML + 原生 JS（无构建），但功能变复杂后维护性差，不推荐。

### 2.1 本地运行方式

```bash
npm install
npm run dev        # 开发，热更新，访问 http://localhost:5173
npm run build      # 生成静态文件到 dist/
npm run preview    # 本地预览打包结果
```

- `dist/` 就是一堆静态文件，未来部署到 GitHub Pages / Vercel / Cloudflare Pages 都行，**始终不需要自建后端**。
- 手机访问局域网地址（`http://192.168.x.x:5173`）时核心功能可用；**Service Worker / 离线安装需要 HTTPS 或 localhost**，故属于第二阶段。

---

## 3. 功能规划

### 3.1 核心（MVP，第一阶段）
1. 上传 / 拖拽 / 拍照导入图片。
2. 设定输出豆子网格尺寸（宽 × 高，单位：颗豆）。
   - 保持宽高比 / 手动锁定比例。
   - 支持常用底板规格预设（如 29×29、50×50 等）。
3. 用 MARD 色卡做最近色匹配，生成像素图。
4. 预览：原图 / 像素图对比。
5. 绘制网格图纸（每颗豆画格、标注色号）。
6. 导出 PNG。
7. 用色统计（每个色号用多少颗）。

### 3.2 第二阶段

**已完成**
- ✅ **限制使用颜色数量**（8/12/16/20/24/32 色），用 palette-constrained k-means 自动选最合适的子集。
- ✅ **抖动**：Floyd–Steinberg 误差扩散 / Bayer 有序抖动（在两最近色卡色间按比例抖动，纯色区域不产生杂色），可选，且在选定 N 色内抖动。
- ✅ **网格坐标标注**（行/列号，从 1 开始）。
- ✅ **背景处理**：保留背景 / 透明背景 / 按颜色去除。
  - 「保留背景」：普通照片的默认项，背景照常放豆子。
  - 「透明背景」：仅对自带 alpha 通道的图片（抠好的 PNG）有意义（按平均 alpha 低于阈值判空）；对不透明照片与「保留背景」完全相同，界面会在无 alpha 时禁用并提示。
  - 「按颜色去除」：在像素预览里点选背景色、自动取四角、容差调节，外加**边缘阈值**（前景占比低于该值的格子视为背景，清掉零星残留）；在**源像素级**剔除背景后再做区域平均，避免边缘混色；去掉的格子不放豆子、也不参与限色与统计。

**待做（建议顺序）**
1. **图纸分页导出 A4 PDF**：每页带页码与拼接定位标记。← **下一步从这里开始**
2. **保存/加载工程文件**（本地 JSON 或 IndexedDB）。
3. **撤销/重做**（需要先有手工编辑像素才有意义）。
4. **接入 PWA**（manifest + Service Worker），手机「添加到主屏幕」、离线可用；此时需要 HTTPS 静态托管。

**暂缓（以后再说）**
- ⏸️ **批量处理多张图**：用户决定暂时不做。

### 3.3 第三阶段（可选）
- Tauri 打包桌面安装包。
- 云同步（需后端，谨慎评估）。
- 社区色卡分享（Hama / Artkal / Perler / COCO / MARD 互转）。

---

## 4. MARD 色卡数据 ✅（已解决）

**原阻塞项已解除。** 已找到并核对可用的公开色卡数据，且已保存到本项目。

### 4.1 数据来源（重要）

- 上游仓库：`HansBug/pindou-color-data`（GitHub），许可 **MIT**。
- 仓库描述：“国内拼豆色卡数据仓库：JSON、XLSX、PDF 图例，适合作为 submodule 引用”，28 stars。
- 已下载并校验：
  - `mard-221-github/colors.json` — **MARD 221 色**（公开源码库版），主流度评级 **S / 5.0**（“国内最主流/默认参考”）。
  - `mard-291-github/colors.json` — **MARD 291 色**（= 221 标准 + 70 扩展），主流度 **S / 4.7**。
- 每个文件附 `README.md`（人工可读说明）、许可证 `LICENSE`，以及全仓库索引 `manifest.json`。
- 本地路径：`reference/pindou-color-data/`（见第 6 节目录结构）。

数据生成日期（上游标注）：2026-05-19。

### 4.2 默认取哪套

- **默认使用 MARD 221**（最主流、店家备货最全、图纸交流基准）。
- 291 作为**可选扩展色卡**，在设置里让用户切换。

### 4.3 数据结构

上游 JSON：

```json
{
  "schema": "pindou-color-palette",
  "id": "mard-221-github",
  "title": "MARD家源码版",
  "count": 221,
  "groups": { "A": 26, "B": 32, "C": 29, "D": 26, "E": 24, "F": 25, "G": 21, "H": 23, "M": 15 },
  "colors": [
    { "code": "A1", "hex": "#FAF5CD", "rgb": [250, 245, 205], "group": "A", "source": "src1" }
  ]
}
```

- 字段：`code`（色号）、`hex`、`rgb`（三元数组）、`group`（色系字母）、`source`（上游来源标记）。
- **公开数据无色名**，界面名称即色号（如 `A1`）。
- 色系分组名（中文）需我们自己映射，例如：
  - A 黄橙、B 绿、C 蓝青、D 紫蓝、E 粉红、F 红、G 橙棕、H 黑白灰、M 莫兰迪。
  - 291 额外：P 柔和过渡、Q 亮色点缀、R 高饱和补充、T 近白透明、Y 明亮荧光、ZG 莫兰迪扩展。

### 4.4 可信度与注意事项 ⚠️

- 上游数据来自**公开源码库/工具站**，`source: "src1"`，**不等同于 MARD 官方标准**。上游称 hex/rgb “已清洗核对”，但严谨对色仍以**实物色卡**为准。
- RGB 是**屏幕参考值**，不等于实物豆子颜色；不同屏幕显示偏差大。
- 界面中应标注数据来源与“屏幕参考值”提示。
- 使用 MIT 数据需**保留版权与许可声明**：保留 `reference/pindou-color-data/LICENSE`，并在应用“关于”页致谢 `HansBug/pindou-color-data`。

### 4.5 数据落地方式

- 写一个构建脚本 `scripts/gen-palette.mjs`：读取 `reference/.../colors.json` → 生成 `src/data/palettes/mard.ts`。
- 生成的数据类型：

```ts
interface BeadColor {
  id: string;                       // 色号，如 "A1"
  hex: string;                      // "#FAF5CD"
  rgb: [number, number, number];    // [250, 245, 205]
  group: string;                    // "A"
  groupName: string;                // "黄橙"
  lab: [number, number, number];    // 启动时/生成时预计算
}
```

- `lab` 在生成脚本里一并算好，减少运行时开销（也可首次加载时预计算）。
- 可选：同时生成/保留 `perler`、`hama`、`artkal`、`coco` 等色卡（上游仓库都有），便于第三阶段做品牌互转。**第一阶段只做 MARD。**

---

## 5. 已确认决定 ✅

1. **框架：Vue 3**（`<script setup>` + Vite + TS + Tailwind）。理由：单文件组件最省代码，运行时小，与构建链配合简单；核心计算在 Canvas/Worker，与框架无关。
2. **第一阶段纯本地**，不做 PWA、不部署。
3. **界面先只做中文**（文案集中存放，方便以后加英文）。
4. **第二阶段功能优先级待定**：限色数 / 抖动 / 去背景 / 分页 PDF 的先后顺序，等第一阶段跑通后再排。
5. 目标打印尺寸 / 是否强依赖 A4 分页：第二阶段再定。

> 色卡数据来源已解决（见第 4 节）：`HansBug/pindou-color-data` 的 mard-221（默认）/ mard-291（可选）。

---

## 6. 目录结构

```
perler_beads/
├─ DESIGN.md                    # 本文档
├─ index.html
├─ package.json                 # scripts: dev/build/preview/test/typecheck/gen:palette
├─ vite.config.ts
├─ tsconfig.json
├─ .gitignore                   # 含 Snipaste_*.png（本地截图不提交）
├─ scripts/
│  └─ gen-palette.mjs           # reference JSON → src/data/palettes/mard221.ts / mard291.ts
├─ reference/                   # 只读外部参考数据（不参与打包）
│  └─ pindou-color-data/        # HansBug/pindou-color-data (MIT)
│     ├─ LICENSE / manifest.json
│     ├─ mard-221-github/{colors.json,README.md}
│     └─ mard-291-github/{colors.json,README.md}
├─ src/
│  ├─ main.ts
│  ├─ App.vue                   # 主界面：状态编排 + 布局
│  ├─ style.css                 # Tailwind 入口
│  ├─ types.ts                  # 全局类型（BeadColor/Palette/BeadGrid/ProjectSettings…）
│  ├─ vite-env.d.ts
│  ├─ components/
│  │  ├─ ImageUploader.vue      # 上传/拖拽
│  │  ├─ SizeSettings.vue       # 网格尺寸 + 锁比例 + 预设
│  │  ├─ PaletteSelect.vue      # 色卡选择
│  │  ├─ PixelPreview.vue       # 像素预览
│  │  ├─ GridPreview.vue        # 网格图纸预览
│  │  ├─ GridSettings.vue       # 网格显示设置
│  │  ├─ ColorStats.vue         # 用色清单
│  │  └─ ExportPanel.vue        # PNG/CSV 导出
│  ├─ core/                     # 纯逻辑，可在 Node 下单测
│  │  ├─ color.ts               # sRGB↔Lab、CIEDE2000
│  │  ├─ pixelate.ts            # 降采样取样（保留 / 透明 / 按色去除）
│  │  ├─ matcher.ts             # 最近色匹配 nearest / nearest2 + 统计
│  │  ├─ quantize.ts            # 限制颜色数量（palette-constrained k-means）
│  │  ├─ dither.ts              # Floyd–Steinberg / Bayer 有序抖动
│  │  ├─ grid.ts                # 网格图纸渲染（可测的 2D 上下文接口）
│  │  ├─ exporter.ts            # PNG（含用色清单）/ CSV 导出
│  │  ├─ image.ts               # 文件 → ImageData
│  │  └─ pixelateClient.ts      # Worker 客户端（共享 worker + id 对应并发）
│  ├─ workers/
│  │  └─ pixelate.worker.ts     # 降采样 + 匹配 + 限色 + 抖动（源图只传一次）
│  └─ data/palettes/
│     ├─ mard221.ts             # 生成：221 色
│     ├─ mard291.ts             # 生成：291 色
│     └─ index.ts               # 运行时封装（预计算 Lab、默认色卡）
└─ tests/                       # 12 个文件 / 95 项（vitest）
```

---

## 7. 数据结构草案

```ts
interface BeadColor {
  id: string;                     // 色号，如 "A1"
  hex: string;                    // "#FAF5CD"
  rgb: [number, number, number];
  group: string;                  // "A"
  groupName: string;              // "黄橙"
  lab: [number, number, number];  // 预计算
}

interface BeadGrid {
  width: number;                  // 列数
  height: number;                 // 行数
  cells: (string | null)[];       // 每格色号 id，null = 空格/透明
}

interface ProjectSettings {
  targetWidth: number;
  targetHeight: number;
  maxColors?: number;
  dither: 'none' | 'floyd-steinberg' | 'ordered';
  background?: 'keep' | 'transparent';
  paletteId: 'mard' | 'mard291';  // 第一阶段仅 MARD 两套
}
```

---

## 8. 执行步骤

1. ~~确认第 5 节问题~~ ✅（Vue 3 / 纯本地 / 中文）。
2. ~~初始化 Vite + Vue3 + TS + Tailwind 项目~~ ✅（TS 锁 5.9）。
3. ~~写 `scripts/gen-palette.mjs`，生成 `src/data/palettes/mard*.ts`~~ ✅（221 + 291 色已生成）。
4. ~~实现 `core/color.ts`（LAB / CIEDE2000）+ 单元测试~~ ✅（18 个测试全过，含 Sharma 官方参考对）。
5. ~~实现图片读取 → 缩放取样 → 最近色匹配（Web Worker）~~ ✅（`core/image.ts`、`core/pixelate.ts`、`core/matcher.ts`、`workers/pixelate.worker.ts`；源图只传一次，改尺寸只重算匹配）。
6. ~~实现可打印网格图纸（画格 + 标注色号）~~ ✅（`core/grid.ts`、`GridPreview`/`GridSettings`；支持纯色/仅色号/填色+色号、网格线、行列坐标、每 N 格粗线）。
7. ~~实现 PNG 导出 + 用色统计~~ ✅（`core/exporter.ts`、`ExportPanel`；PNG 支持 1/2/3x 倍率、可附带用色清单，另有清单 CSV 导出；超大网格自动降低倍率）。
8. ~~本地自测~~ ✅（用户已验收）。
9. （第二阶段）进阶功能：
   - ~~限制使用颜色数量~~ ✅
   - ~~抖动~~ ✅
   - ~~网格坐标标注~~ ✅（随网格图纸完成）
   - ~~背景处理~~ ✅（保留 / 透明 / 按颜色去除；源像素级去背景 + 预览拾色 + 自动取四角 + 容差 + 边缘阈值）
   - **分页 A4 PDF** ← 下一步
   - 保存/加载工程
   - 撤销/重做
   - 批量处理 —— ⏸️ **暂缓（以后再说）**
10. （第二阶段）接入 PWA + 静态托管；需要 HTTPS 时才部署。
11. （第三阶段，可选）Tauri 打包桌面版。

---

## 9. 备注

- 本项目第一阶段无需后端即可跑通；部署也只是静态文件，不需要服务器。
- 不要直接双击 `index.html`，用本地静态服务（`npm run dev` / `preview`）。
- 手机端性能是重点：大网格用 Web Worker + `OffscreenCanvas`，避免主线程卡顿。
- 导出图纸时注意超长边图片的分块渲染，防止 Canvas 超过浏览器尺寸上限。
- 色卡数据是屏幕参考值，务必在界面提示来源与“以实物色卡为准”。
- 保留 `reference/pindou-color-data/LICENSE` 并在关于页致谢。

---

## 10. 交接与继续开发（新会话先读这节）

### 10.1 运行 / 验证

```bash
npm install              # 首次
npm run dev              # 开发，http://localhost:5173
npm run dev -- --host    # 手机同局域网访问
npm test                 # 95 项单元测试
npm run typecheck        # vue-tsc 类型检查
npm run build            # 生产构建（含类型检查）
npm run gen:palette      # 由 reference/ 重新生成色卡（一般不用跑）
```

### 10.2 关键约定 / 踩过的坑（务必先读）

- **TypeScript 锁 5.9**：TS 7（Go 重写版）与 `vue-tsc` 不兼容，**不要升级**。
- **预览组件首绘**：用 `onMounted(render)` + `watch(..., { flush: 'post' })`；**不要**用 `watch({ immediate: true })`（会在挂载前执行，`canvas` 仍为 null，导致首次空白）。
- **Worker 只接收一次源图**：`setSourceImage` 会 transfer 掉 `imageData.data.buffer`；之后改尺寸/色卡/抖动只调用 `pixelate`。
- **CIEDE2000 大色差特性**：在缺少灰阶的色卡上，中灰可能匹配到同亮度饱和色（与参考库 `delta-e` 逐位一致，非 bug）；真实 MARD 含完整灰阶无此问题。`tests/deltaE.reference.test.ts` 持续校验。
- **有序抖动**用「最近两色按比例」策略（`ratio = d1/(d1+d2)`），保证纯色区域不产生杂色；**不要**退回「固定幅度阈值扰动」写法。
- **限色**用 palette-constrained k-means（`quantize.ts`），聚类用 Lab 欧氏距离（快），最终匹配用 CIEDE2000（准）。
- **背景去除在源像素级完成**（`downsample`）：与 `removeColor` 距离在 `tolerance`（RGB 欧氏）内的源像素被剔除后求平均，避免边缘混色；前景像素占比低于 `minCoverage`（默认 0.15）的格子视为背景。`pixels` 是最终结果，`samples` 是未去除的原始平均色，专供界面拾色。改这块时不要图省事改成「先降采样再按色号剔除」。
- **「保留背景」与「透明背景」对不透明照片完全等价**：前者与白底合成、后者按 alpha 判空，而普通照片 alpha 全为 255，故看起来一样。`hasTransparency()` 检测到无 alpha 时会禁用「透明背景」按钮（在把 ImageData 交给 Worker 前调用，因为 buffer 会被 transfer）。
- **传给 Worker 的数据必须可结构化克隆**：Vue 的 `ref` 会把数组包成 Proxy，直接 `postMessage` 会报 `could not be cloned`。因此 `removeColor` 用 `shallowRef`，且 `pixelateClient.pixelate()` 会再转成普通数组。新增跨 Worker 参数时务必注意（`tests/pixelateClient.test.ts` 防回归）。
- **实时控件与合并策略**：容差 / 边缘阈值 / 抖动强度用 `requestRun()` 立即触发（拖动实时刷新）；尺寸 / 色卡 / 模式等用 `scheduleRun()`（120ms 防抖）。`run()` 内部用 `running`/`queued` 保证同一时刻只跑一个任务，结束后再用**最新**参数补跑一次，因此拖动滑块不会堆积请求（`busy` 会在队列排空后才消失）。不要改回单纯的 `watch` 防抖，否则又会变成「停下来才更新」。
- 色卡是**屏幕参考值**，界面/文档需保留「以实物色卡为准」提示。
- `reference/` 为只读外部数据，不要改；改色卡请改 `scripts/gen-palette.mjs` 后重生成。
- 本地截图 `Snipaste_*.png` 已被 `.gitignore` 忽略；不要 `git add -f` 强加。

### 10.3 下一步

从 **分页 A4 PDF** 开始（见 3.2）：把整张网格图纸按 A4 纸切页导出，每页带页码与拼接定位标记。可复用 `core/grid.ts` 的 `renderGrid`，新增 `core/pdf.ts`（jsPDF）或分块渲染后逐页导出。涉及 `core/exporter.ts`、`ExportPanel` 与依赖（新增 jsPDF）。
