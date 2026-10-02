# 拼豆图纸生成器 — 设计文档

> 状态：**第二阶段进行中（暂存，明天继续）** —— 第一阶段 MVP 已验收。
> 已完成：限制颜色数量、抖动（Floyd–Steinberg / Bayer 有序）、网格行列坐标。
> 下一步建议：**背景处理** → 分页 A4 PDF → 保存/加载工程 → 撤销/重做 → PWA。
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

**待做（建议顺序）**
1. **背景处理**：手动去背景（点选背景色 + 容差 / 自动取四角色），去掉的颜色不参与配色。← **下一步从这里开始**
2. **图纸分页导出 A4 PDF**：每页带页码与拼接定位标记。
3. **保存/加载工程文件**（本地 JSON 或 IndexedDB）。
4. **撤销/重做**（需要先有手工编辑像素才有意义）。
5. **接入 PWA**（manifest + Service Worker），手机「添加到主屏幕」、离线可用；此时需要 HTTPS 静态托管。

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

## 6. 目录结构（执行时参考）

```
perler_beads/
├─ DESIGN.md                    # 本文档
├─ index.html
├─ package.json
├─ vite.config.ts
├─ scripts/
│  └─ gen-palette.mjs           # reference JSON → src/data/palettes/*.ts
├─ reference/                   # 只读的外部参考数据（不参与打包）
│  └─ pindou-color-data/        # 来源: HansBug/pindou-color-data (MIT)
│     ├─ LICENSE
│     ├─ manifest.json
│     ├─ mard-221-github/
│     │  ├─ colors.json
│     │  └─ README.md
│     └─ mard-291-github/
│        ├─ colors.json
│        └─ README.md
├─ public/
│  └─ icons/                    # 图标（PWA 图标推迟到第二阶段）
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ components/
│  │  ├─ ImageUploader.vue
│  │  ├─ SizeSettings.vue
│  │  ├─ PaletteSettings.vue
│  │  ├─ PreviewCanvas.vue
│  │  └─ BeadGrid.vue
│  ├─ core/
│  │  ├─ color.ts               # RGB/HEX/LAB 转换、CIEDE2000
│  │  ├─ matcher.ts             # 最近色匹配、颜色数限制
│  │  ├─ dither.ts              # 抖动算法（第二阶段）
│  │  ├─ pixelate.ts            # 图像缩放/取样
│  │  └─ exporter.ts            # PNG/SVG 导出
│  ├─ workers/
│  │  └─ pixelate.worker.ts
│  ├─ data/
│  │  └─ palettes/
│  │     ├─ mard.ts             # 由 gen-palette.mjs 生成
│  │     └─ index.ts
│  └─ types.ts
└─ tests/
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
   - **背景处理** ← 下一步
   - 分页 A4 PDF
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
