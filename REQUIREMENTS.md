# LittleFile — 文本文件库管理系统 需求文档

> 版本：2.2  
> 日期：2026-05-06  
> 状态：新增文件库历史记录与跨库快捷选择

---

## 1. 项目背景

### 1.1 现状与问题

用户拥有 **10 万+ 个纯文本文件**（.txt），具有以下特征：

| 属性 | 值 |
|------|-----|
| 文件数量 | ~100,000+ |
| 单文件大小 | 1KB ~ 50MB，多数在 ~5MB |
| 总数据量 | 约 500GB |
| 文本编码 | 混杂（UTF-8、GB2312、GBK、Big5 等） |
| 内容语言 | 中文、英文及混合 |

当前以操作系统文件系统直接管理，存在以下痛点：

1. **空间浪费**：大量小文件占用磁盘簇空间，NTFS 碎片化严重
2. **查询效率低**：按内容查找文件需逐文件扫描，极慢
3. **管理困难**：无法对文件进行统一的分类、标记、描述
4. **备份/迁移困难**：10 万个零散文件难以整体打包、转移、校验
5. **跨库操作困难**：无法方便地在不同文件库之间移动或复制文件

### 1.2 项目目标

构建一个 **桌面 GUI 应用程序**，将所有文本文件以压缩形式存储在 **单个 SQLite 数据库文件** 中，提供统一的搜索、标签分类和阅读管理能力。

### 1.3 核心设计原则

| 原则 | 说明 |
|------|------|
| **单文件数据库** | 所有内容存入一个 .db 文件，便于备份、迁移、校验 |
| **压缩存储** | 使用 zlib 压缩文本内容，预计将 500GB 压缩至 ~175GB |
| **一次构建、长期只读** | 导入完成后，日常以查询和阅读为主，极少增删 |
| **不提供编辑** | 文本内容仅供阅读查看，不做任何编辑功能 |
| **纯开源自建** | 全部基于开源技术栈，自行开发 |

---

## 2. 技术选型

### 2.1 技术栈

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 桌面框架 | **Tauri 2.x** | ≥ 2.0 | Rust 后端 + 系统 WebView，打包 2-10MB |
| 外部调用 | **tauri-plugin-opener** | latest | 用系统默认程序或指定程序打开文件 |
| 前端框架 | **React 18+** | ≥ 18 | 组件化 UI |
| UI 组件库 | **Ant Design 5** | ≥ 5 | 企业级 React 组件库，中文友好，按需加载 |
| 虚拟列表 | **@tanstack/react-virtual** | v3 | 100K+ 文件列表流畅渲染 |
| 文本阅读引擎 | **SimpleTextReader 提取** | — | 提取核心文本处理 + 智能分页渲染，MIT 许可 |
| 后端语言 | **Rust** | stable | Tauri 原生后端 |
| 数据库 | **SQLite** | ≥ 3.45 | 内置于 Rust (rusqlite) |
| 压缩 | **flate2** (zlib) | latest | Rust 生态，比 C 实现快 6-14% |
| 编码检测 | **charset** (Rust crate) | latest | 自动检测文件编码 |
| 构建工具 | **Vite** | ≥ 5 | 快速 HMR 开发体验 |
| 语言 | **TypeScript** | ≥ 5 | 前端类型安全 |

### 2.2 选型理由

- **Tauri 2.x**：打包体积极小（2-10MB），内存占用低（30-80MB），Rust 后端原生支持 zlib 解压和 SQLite 操作
- **React + Ant Design**：成熟的中文 UI 组件生态，标签选择器、搜索框、表格等开箱即用。使用 `unplugin-antd` 或 `babel-plugin-import` 实现按需引入
- **SimpleTextReader 提取**（[GitHub](https://github.com/henryxrl/SimpleTextReader)）：MIT 许可的中文 TXT 阅读器，提取其核心文本处理引擎——自动编码检测、章节标题识别（正则 + 模式学习）、智能分页（在章节处断页、短章合并、长章拆分）、脚注系统。原 CodeMirror 6 替换为沉浸式书本阅读体验。保留的模块：`text-processor-core.js`、`pagination-calculator.js`、`title-pattern-detector.js`、`footnotes.js`；移除的部分：浏览器扩展、书架/IndexedDB、字体池、服务端。核心阅读逻辑在 Web Worker 中执行，前端 React 组件负责渲染
- **tauri-plugin-opener**：调用系统默认程序打开文件（如记事本、Notepad++、浏览器），用户可自选阅读器
- **SQLite 单文件**：零运维，WAL 模式支持并发读取，单文件便于备份迁移

---

## 3. 功能需求

### 3.1 文件库管理

#### FR-1.1 创建文件库
- 用户可创建新的空文件库（即新建一个 .db 文件）
- 创建时可指定：库名称、存储路径、描述
- 创建时自动应用最优 PRAGMA 配置（WAL、page_size=16384 等）

#### FR-1.2 打开文件库
- 用户可打开已有的 .db 文件
- 打开时快速校验：仅验证 `db_meta` 表存在，确认是 LittleFile 库
- **不自动执行 `integrity_check`**（大库校验很慢，由用户手动触发）
- 若数据库版本不匹配，自动按序执行迁移（详见 §5.4）
- 打开进度：显示"正在加载..."（含数据库元信息、标签列表加载）

#### FR-1.3 文件库概览
- 显示当前库的统计信息：文件总数、总大小、压缩后大小、标签数量、创建时间
- 显示最近导入/添加的文件列表

#### FR-1.4 关闭文件库
- 关闭时执行 WAL checkpoint，确保数据落盘
- 释放所有文件句柄和内存映射

#### FR-1.5 文件库历史记录
- 应用自动记录所有成功打开过的文件库路径，存储到本地配置
- 历史记录条目包含：库名称、完整路径、最后打开时间
- 历史列表按最后打开时间倒序排列，最近使用的在前
- 同一文件库重复打开时，更新其最后打开时间（去重，不产生重复记录）
- 历史记录数量上限为 20 条，超出时自动移除最旧的条目

**打开库时**：
- 主界面提供"最近打开的文件库"列表（下拉菜单或侧边栏）
- 点击历史记录中的条目直接打开该库
- 打开文件库对话框中也显示历史记录快捷入口

**失效检测**：
- 点击历史记录条目时，Rust 端先检查文件是否存在（`std::fs::metadata`）
- 若文件已不存在（被移动/删除），弹出提示"文件库已移动或删除"，并自动从历史记录中移除该条目
- 不阻塞用户操作——检测到失效即刻移除，无需用户手动清理

---

### 3.2 文件导入

#### FR-2.1 批量导入文件
- 支持选择文件夹或多个文件进行批量导入
- 自动递归扫描子目录中的 .txt 文件
- 导入流程：
  1. 用户选择源路径（文件夹/文件列表）
  2. 预扫描：统计文件数量、总大小、预估耗时
  3. 用户确认后开始导入
  4. 逐文件处理：
     a. 检测文件编码（charset 检测）
     b. 解码为 UTF-8（记录原始编码）
     c. 若启用文件名解析（FR-2.5），按正则表达式从文件名中提取：显示名、作者、标签
     d. zlib 压缩文本内容
     e. 计算文件 SHA-256（用于去重和完整性校验）
     f. 写入数据库
  5. 显示进度：已完成数/总数、当前文件名、耗时预估
  6. 完成后显示导入摘要

#### FR-2.2 导入配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 批量大小 | 500 | 每次事务提交的行数 |
| 去重策略 | 跳过 | 遇到同名/同哈希文件时：跳过/覆盖/报错 |
| 文件名冲突 | 保留原名 | 同名文件处理策略 |
| 导入后操作 | 无 | 导入完成后是否删除源文件 |
| 文件名解析 | 关闭 | 是否启用正则解析（详见 FR-2.5） |

#### FR-2.3 断点续传
- 导入过程如被中断（用户取消或异常），记录已处理到的位置
- 重新导入时可选择从断点继续，而非从头开始

#### FR-2.4 导入单个文件
- 除批量导入外，支持手动添加单个文件
- 添加时可直接填写描述和标签

#### FR-2.5 文件名正则解析（可选）
- 导入时可启用文件名解析功能，用正则表达式从文件名中自动提取元数据
- 适用场景：文件名遵循固定命名规范（如 `作者-标题-标签.txt`），无需手动填写
- 配置项：

  | 参数 | 默认值 | 说明 |
  |------|--------|------|
  | 启用解析 | 关闭 | 是否在导入时执行文件名解析 |
  | 正则表达式 | — | 用户定义的正则，使用命名捕获组 |
  | 预览 | — | 实时预览解析结果（拿第一个文件名演示） |

- 支持的捕获组名称（通过正则命名捕获组 `(?P<name>...)` 提取）：

  | 捕获组名 | 映射到 | 说明 |
  |----------|--------|------|
  | `filename` | 文件显示名 | 可覆盖原始文件名 |
  | `author` | 作者字段 | 记录文本作者 |
  | `tag` 或 `tags` | 标签（逗号分隔） | 自动打标签 |
  | `description` | 简介 | 自动填写简介 |
  | `date` | — | 可辅助时间筛选 |

- 示例：`^(?P<author>[^-]+)-(?P<filename>[^-]+)-(?P<tags>.+)\.txt$`
  对 `张三-2026年度总结-工作,重要.txt` → 显示名: 2026年度总结, 作者: 张三, 标签: 工作, 重要
- 解析失败时（正则不匹配），保留原始文件名，作者和标签留空
- 正则解析结果优先级低于用户手动填写的值

---

### 3.3 文件列表与浏览

#### FR-3.1 文件列表

| 列 | 说明 | 可排序 | 可筛选 |
|----|------|--------|--------|
| 文件名 | 原始文件名 | ✅ | ✅ |
| 作者 | 文本作者 | ✅ | ✅ |
| 大小 | 原始文件大小 | ✅ | ✅（范围） |
| 描述 | 简介文本 | ❌ | ✅（模糊） |
| 标签 | 已打标签列表 | ❌ | ✅（多选） |
| 编码 | 原始编码 | ❌ | ❌ |
| 导入时间 | 导入数据库的时间 | ✅ | ✅（范围） |

- 使用虚拟滚动（@tanstack/react-virtual），100K+ 文件流畅渲染
- 支持列宽拖拽调整、列显示/隐藏
- **单击选中**文件时，底部预览面板显示文件前 20 行（FR-3.5）
- **双击**文件打开完整阅读视图（FR-7.1）

#### FR-3.2 文件列表排序
- 点击列头排序，支持升序/降序切换，默认按导入时间倒序

#### FR-3.3 文件列表无限滚动
- 采用无限滚动模式（虚拟滚动天然支持）

#### FR-3.4 文件多选
- 支持 Ctrl+Click、Shift+Click、Ctrl+A，多选后可批量操作

#### FR-3.5 文件预览面板
- 选中文件时底部/右侧显示前 20 行预览，可折叠/展开

#### FR-3.6 用外部程序打开
- 右键 → 用外部程序打开（解压到临时文件 → 调用系统默认程序或自定义阅读器，详见 FR-11.3）

---

### 3.4 搜索与筛选

#### FR-4.1 文件名搜索
- 顶部搜索框实时筛选，模糊匹配（`LIKE '%keyword%'`），不区分大小写

#### FR-4.2 简介模糊搜索
- 可切换搜索范围为"简介"字段，搜索结果高亮匹配关键词

#### FR-4.3 标签筛选
- 侧边栏展示所有标签列表及文件数量，点击筛选，支持 AND/OR 组合

#### FR-4.4 组合筛选
- 文件名搜索、简介搜索、标签筛选可同时使用（AND 逻辑），提供一键清除

#### FR-4.5 高级筛选（可选）
- 文件大小范围、导入时间范围、作者筛选、编码类型、是否有描述/标签

---

### 3.5 标签管理

- **创建标签**：标签名不区分大小写、唯一、2-50 字符
- **打标签**：右键/工具栏/批量、标签自动补全
- **移除标签**：点击 × 按钮、支持批量移除
- **重命名/删除**：双击编辑、删除确认、自动解除关联
- **标签统计**：显示每个标签的文件数量，支持按数量排序

---

### 3.6 文件描述（简介）

- 每个文件可附加 ≤ 500 字符描述
- 列表中双击描述列编辑，文件详情面板也可编辑
- 支持批量设置描述

---

### 3.7 文件阅读（核心功能）

> **技术说明**：阅读引擎提取自 [SimpleTextReader](https://github.com/henryxrl/SimpleTextReader)（MIT 许可），保留其文本处理核心（编码检测、章节标题识别、智能分页、脚注系统），重写为 React 组件并适配 Tauri IPC 数据接口。

#### FR-7.1 双击打开阅读
- 双击文件条目 → Rust 端解压传回文本 → 前端 Web Worker 异步处理（编码校验、行分割、标题提取、智能分页） → 展示首章/首页
- 处理中显示 SVG 加载动画

#### FR-7.2 阅读器核心功能

| 功能 | 说明 |
|------|------|
| **智能分页** | 优先在章节标题处断页，短章合并，长章拆分；中文按字数、英文按行数 |
| **章节目录** | 自动识别章节标题，左侧 TOC 面板展示，点击跳转 |
| **页码导航** | 底部分页栏：上一页/下一页、页码跳转、当前页/总页数 |
| **字体缩放/切换** | Ctrl+滚轮 或工具栏按钮；内置中文字体 + 3 个自定义字体 |
| **暗黑模式** | 跟随系统主题或手动切换 |
| **自动换行** | 可切换，影响分页计算 |
| **选中复制** | Ctrl+C 复制选中文本 |
| **脚注支持** | 自动识别 ①-㊿ 标记，hover 显示脚注 |
| **扉页信息** | 书名、作者、编码信息 |
| **阅读进度** | 自动保存当前行号，下次打开恢复 |
| **编码信息** | 底部状态栏显示原始编码 |
| **文内搜索** | 全文关键词搜索，高亮所有匹配项，Enter/Shift+Enter 导航，显示匹配计数 |

#### FR-7.3 文本处理流水线（Web Worker 中执行）
```
Rust 端解压文本 → 编码校验 → 语言检测 → 标题模式学习 →
文本行处理 → 章节提取 → 脚注解析 → 智能分页计算 → React 渲染
```
大文件优化：< 1MB 一次性处理；≥ 1MB 先处理前 1MB（首屏秒开），后台继续

#### FR-7.4 阅读视图布局
- **左侧**：章节目录面板（可折叠，当前章节高亮，悬停展开完整标题）
- **中间**：文本阅读区域（扉页、正文段落、章节分隔、脚注标记）
- **顶部**：工具栏（目录切换、章节导航、字体缩放、字体选择、自动换行、外部程序打开）
- **底部**：分页导航 + 状态栏（页码、编码、阅读进度）
- **右侧**：文件元信息面板（可折叠：文件名、作者、大小、编码、标签、描述）

#### FR-7.5 键盘导航
| 快捷键 | 功能 |
|--------|------|
| ← / → | 上一页 / 下一页 |
| Page Up / Down | 上一章 / 下一章 |
| Ctrl+F | 打开文内搜索栏（FR-7.5a） |
| Enter（搜索栏聚焦） | 下一个匹配结果 |
| Shift+Enter | 上一个匹配结果 |
| Esc（搜索栏打开时） | 关闭搜索栏、清除高亮 |
| Ctrl++ / Ctrl+- | 字体缩放 |
| Ctrl+0 | 重置字体大小 |
| Ctrl+C | 复制选中文本 |
| Ctrl+Shift+O | 用外部程序打开 |
| Escape | 返回文件列表 |
| Space | 向下滚动一屏 |

#### FR-7.5a 文内搜索
- Ctrl+F 在阅读视图顶部打开搜索栏（自定义实现，非浏览器原生）
- 搜索范围：当前文件的完整文本（`ProcessedBook.htmlLines` 全文）

| 功能 | 说明 |
|------|------|
| **实时搜索** | 输入时实时高亮当前页所有匹配项 |
| **全页高亮** | 匹配项以黄色（#FFEB3B）背景标记 |
| **当前匹配** | 当前焦点匹配以橙色（#FF9800）标识 |
| **匹配计数** | 搜索栏显示 "第 N / M 个" |
| **结果导航** | Enter 下一匹配；Shift+Enter 上一匹配；自动滚动到目标 |
| **跨页导航** | 当前页无更多结果时自动翻到包含下一个匹配的页面 |
| **区分大小写** | [Aa] 切换按钮，默认不区分 |
| **全词匹配** | [ab] 切换按钮，默认关闭（子串匹配） |
| **清除搜索** | × 按钮或 Esc 清除、移除高亮 |
| **无结果提示** | 显示 "无匹配结果" |
| **大文件处理中** | 提示 "正在处理全文，搜索结果可能不完整" |

- 实现原理：在 `htmlLines` 数组上执行纯文本匹配（`indexOf` 循环），生成 `SearchMatch[]`，渲染当前页时对匹配位置做 `<mark>` 包裹。50MB ~100 万行单次搜索 < 200ms

#### FR-7.6 关闭阅读
- ESC 或返回按钮退出，自动保存阅读位置到数据库

#### FR-7.7 阅读进度持久化
- 退出时保存当前行号到 `files.last_read_line`，下次打开自动恢复
- 已读文件图标与未读区分，读至末页标记为"已读完"（`is_read = 1`）

#### FR-7.8 用外部程序打开
- 工具栏提供按钮，解压到临时文件 → 调用系统默认程序或自定义阅读器（FR-11.3）

---

### 3.8 文件操作

#### FR-8.1 删除文件
- 选中 → 右键/工具栏 → 删除 → 确认对话框（显示文件数量和大小） → 同时清理标签关联

#### FR-8.2 导出文件
- 单文件/批量导出，选项：导出为原始文件 / UTF-8 / 保留原始编码

#### FR-8.3 文件信息查看
- 右键 → 属性显示：文件名、作者、原始路径、大小（原始/压缩/压缩率）、编码、SHA-256、导入时间、标签、描述

---

### 3.9 跨库操作

#### FR-9.1 打开多个文件库
- 支持同时打开多个库（标签页或窗口），每个库独立管理

#### FR-9.2 跨库移动文件
- 选中文件 → 右键 → 移动到 → 弹出目标库选择界面
- 目标库选择界面提供两种方式：
  - **历史记录**（优先）：列出最近打开过的文件库列表（FR-1.5），点击即可选中
  - **手动浏览**：点击"浏览..."按钮手动选择 .db 文件
- 选择目标库后弹出**标签映射对话框**：对每个源标签，选择目标库中的映射（映射到已有/创建新/跳过），提供一键映射同名标签
- 确认后复制文件记录 → 迁移标签关联 → 确认后删除源记录

#### FR-9.3 跨库复制文件
- 与移动类似（同样支持历史记录选择 + 标签映射），但不删除源库记录

#### FR-9.4 合并文件库
- 工具菜单 → 合并库，将源库全部文件导入目标库，自动处理冲突

---

### 3.10 备份与维护

- **数据库备份**（FR-10.1）：`VACUUM INTO` 创建干净备份，自定义路径
- **完整性校验**（FR-10.2）：后台异步执行 `PRAGMA integrity_check`，通过事件 `db:integrity-done` 返回结果
- **数据库优化**（FR-10.3）：`PRAGMA optimize` + `ANALYZE`
- **存储统计**（FR-10.4）：数据库文件大小、压缩节省空间

---

### 3.11 系统设置

#### FR-11.1 应用配置
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 默认文件库路径 | 用户文档目录 | |
| 文本查看器字体 | 微软雅黑 | |
| 字体大小 | 14px | |
| 自动换行 | 开启 | |
| 主题 | 跟随系统 | 亮色/暗色/跟随系统 |
| 语言 | 中文 | |
| 导入批量大小 | 500 | |

#### FR-11.2 配置持久化
- 应用配置保存在 Tauri store 或 JSON 文件，窗口位置大小自动记忆

#### FR-11.3 外部阅读器配置
- 可配置最多 3 个自定义阅读器（名称、路径、是否首选）
- 路径在启动时校验，不存在的标记为"未找到"并置灰

---

## 4. 非功能需求

### 4.1 性能要求

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 文件列表渲染 | 60fps 滚动 | 虚拟滚动，100K+ 文件 |
| 文件名搜索 | <100ms | 带索引的 LIKE 查询 |
| 简介模糊搜索 | <200ms | 100K 行 × 500 字 |
| 标签筛选 | <100ms | 索引 JOIN 查询 |
| 打开阅读（<1MB） | <300ms | 含解压和首屏渲染 |
| 打开阅读（5MB） | <1s | 含首块处理 + 首屏渲染，后台继续 |
| 打开阅读（50MB） | <2s | 首块处理 + 渲染，后台处理剩余 |
| 每页翻页延迟 | <50ms | 分页已预计算 |
| 文内搜索（50MB） | <200ms | indexOf 循环 |
| 批量导入 | 500 文件/分钟 | 含编码检测、压缩、写入 |
| 应用启动 | <2s | 冷启动 |
| 打开文件库（175GB） | <10s | 首次打开，不含 integrity_check |
| 内存占用（空闲） | <150MB | 含 SQLite 缓存 |
| 内存占用（阅读50MB） | <250MB | 虚拟滚动 + mmap |

### 4.2 数据安全
- SHA-256 哈希校验导入前后一致性
- SQLite WAL 模式事务保证原子性
- 定期 `PRAGMA integrity_check`，支持 `VACUUM INTO` 修复
- 删除操作二次确认

### 4.3 可靠性
- 导入中断可断点续传；数据库操作失败自动回滚；大文件流式处理避免 OOM
- 临时文件存放于系统 temp_dir，关闭阅读时删除，应用退出时清理残留

### 4.4 并发控制

| 场景 | 策略 |
|------|------|
| 导入进行中 | 前端禁用标签编辑、文件删除、描述编辑等写操作按钮（置灰） |
| 导入进行中 | 读操作（搜索、列表、阅读）不受影响 |
| 用户强行写操作 | Rust 端返回 `Error::ImportInProgress` |
| 跨库移动/复制 | 目标库被占用时返回 `Error::LibraryBusy` |
| 写操作排队 | `busy_timeout` 排队等待（≤30s），超时则报错 |

### 4.5 兼容性
- Windows 10 x64+ / Windows 11 完全支持；macOS / Linux 预留兼容性

### 4.6 打包与分发
- 单个 MSI/NSIS 安装包 < 15MB
- 无需额外运行时依赖（WebView2 使用系统自带）
- 支持便携版（免安装，解压即用）

---

## 5. 数据模型

### 5.1 ER 关系

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    files      │       │  file_tags   │       │     tags     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ *id (PK)     │───┐   │ *file_id (FK)│───┐   │ *id (PK)     │
│  filename    │   │   │ *tag_id (FK) │   │   │  name        │
│  author      │   │   └──────────────┘   │   │  created_at  │
│  original_path   │   复合主键(file_id,   │   └──────────────┘
│  size /      │       tag_id)           │
│  compressed   │                         │
│  encoding    │                         │
│  description │                         │
│  content     │  BLOB (zlib 压缩)        │
│  sha256      │                         │
│  last_read   │  上次阅读行号             │
│  is_read     │  是否已读完               │
│  created_at  │                         │
└──────────────┘
```

### 5.2 完整 DDL

```sql
PRAGMA journal_mode = WAL;
PRAGMA page_size = 16384;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -32000;
PRAGMA mmap_size = 67108864;
PRAGMA temp_store = MEMORY;
PRAGMA busy_timeout = 30000;

CREATE TABLE files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    author          TEXT NOT NULL DEFAULT '',
    original_path   TEXT DEFAULT '',
    size            INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    encoding        TEXT NOT NULL DEFAULT 'utf-8',
    description     TEXT NOT NULL DEFAULT '',
    content         BLOB NOT NULL,
    sha256          TEXT NOT NULL,
    last_read_line  INTEGER NOT NULL DEFAULT 0,
    is_read         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE TABLE tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE TABLE file_tags (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
) WITHOUT ROWID;

CREATE INDEX idx_files_filename  ON files(filename COLLATE NOCASE);
CREATE INDEX idx_files_author    ON files(author COLLATE NOCASE);
CREATE INDEX idx_files_sha256    ON files(sha256);
CREATE INDEX idx_files_created_at ON files(created_at DESC);
CREATE INDEX idx_file_tags_tag_id ON file_tags(tag_id, file_id);
CREATE INDEX idx_tags_name       ON tags(name COLLATE NOCASE);

CREATE TABLE db_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO db_meta (key, value) VALUES
    ('version', '3'),
    ('name', ''),
    ('description', ''),
    ('created_at', strftime('%Y-%m-%d %H:%M:%S', 'now'));
```

### 5.3 关键查询

```sql
-- 文件名 / 作者 / 简介搜索
SELECT id, filename, author, size, description, created_at
FROM files WHERE filename LIKE '%' || ? || '%' ORDER BY created_at DESC LIMIT 100;

-- 标签筛选 AND / OR
SELECT DISTINCT f.* FROM files f
JOIN file_tags ft ON f.id = ft.file_id JOIN tags t ON ft.tag_id = t.id
WHERE t.name IN (?, ?) ORDER BY f.created_at DESC LIMIT 100;

-- 组合筛选
SELECT DISTINCT f.* FROM files f
JOIN file_tags ft ON f.id = ft.file_id JOIN tags t ON ft.tag_id = t.id
WHERE t.name IN (?, ?) AND f.filename LIKE '%' || ? || '%'
  AND f.author LIKE '%' || ? || '%' AND f.description LIKE '%' || ? || '%'
ORDER BY f.created_at DESC LIMIT 100;

-- 保存阅读进度
UPDATE files SET last_read_line = ?, is_read =
  CASE WHEN last_read_line >= (SELECT content_length...) THEN 1 ELSE 0 END
WHERE id = ?;
```

### 5.4 Schema 迁移策略

数据库版本号存储在 `db_meta.version` 中（整数，递增）。打开文件库时自动检测版本并执行迁移。迁移脚本在 `src-tauri/src/db/migrations/v{N}.rs`，函数签名 `fn migrate(conn: &Connection) -> Result<(), Error>`。迁移在事务中执行，失败自动回滚。

```rust
const MIGRATIONS: &[(i64, &str, fn(&Connection) -> Result<(), Error>)] = &[
    (2, "Add author column", v2::migrate),
    (3, "Add reading progress columns", v3::migrate),
];
```

---

## 6. 界面布局

### 6.1 主界面

```
┌──────────────────────────────────────────────────────────────────┐
│  LittleFile   [库名称]                     [设置] [最小化][关闭]  │
├──────────────────────────────────────────────────────────────────┤
│  🔍 搜索: [文件名/简介搜索框        ] [范围: 文件名 ▾] [清除]    │
├─────────────┬────────────────────────────────────────────────────┤
│  标签面板    │  文件名          │ 作者  │ 大小   │ 描述    │ 标签  │ 时间  │
│  ─────────  │─────────────────────────────────────────────────── │
│  [全部] (500)│  report_001.txt │ 张三  │ 3.2MB  │ 季度报告│ 工作  │ 05-06 │
│  工作  (120) │  notes.txt     │       │ 128KB  │ 备忘录  │ 个人  │ 05-05 │
│  个人  (85)  │  data_2026.txt │ 李四  │ 8.7MB  │         │ 数据  │ 05-04 │
│  技术  (203) │           虚拟滚动区域（仅渲染可见行）               │
│  数据  (92)  │                                                    │
│  [+ 新建标签]│                                                    │
├─────────────┴────────────────────────────────────────────────────┤
│  预览: 1 │ 2026年第一季度工作报告  ...                            │
├──────────────────────────────────────────────────────────────────┤
│  共 500 个文件 │ 已选 3 个 │ 压缩率 65% │ 数据库 175GB           │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 阅读视图（书本式阅读器）

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← 返回   report_001.txt  [☰ 目录] [← 上一章] [下一章 →] [外部打开]  │
├────────┬───────────────────────────────────────┬────────────────────┤
│ 目录    │                                       │  元信息              │
│ ────── │       2026年第一季度工作报告            │  文件名: report.txt  │
│ 第一章  │                                       │  作者:   张三        │
│ 概述    │  一、概述                              │  大小:   3.2MB       │
│ 第二章  │  本报告总结了2026年第一季度的经营情况...   │  编码:   GBK         │
│ 数据    │                                       │  标签: [工作] [Q1]   │
│ 2.1 营收 │  二、详细数据                           │  描述: 季度工作报告   │
│ 2.2 成本 │  2.1 营收数据                          │                    │
│ 第三章  │  本季度总收入为...                      │                    │
│ 总结    │                    ◆                    │                    │
│         │       第二章  详细数据                  │                    │
│         │  2.1 营收数据                          │                    │
├────────┴───────────────────────────────────────┴────────────────────┤
│ 🔍 搜索关键词   第 3 / 15 个  [Aa][ab][×]                            │
│  ← 上一页  第 2 / 45 页  下一页 →     GBK │ 阅读进度 5%              │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 导入对话框

```
┌────────────────────────────────────────────────────┐
│  导入文件                                     [×]  │
├────────────────────────────────────────────────────┤
│  源路径: [D:\documents\txt_files        ] [浏览]   │
│  预扫描结果: · 12,345 个 · 45.6 GB · 预计 ~25 分钟 │
│  选项: 去重策略:[跳过 ▾] 批量:[500] 后操作:[无 ▾]  │
│  ████████████████████░░░░░░░  67%  (8,289/12,345) │
│  正在处理: data_2026_Q1.txt  剩余: ~8分钟         │
│                        [暂停] [取消]  [开始导入]    │
└────────────────────────────────────────────────────┘
```

---

## 7. 技术架构

### 7.1 分层架构

```
┌─────────────────────────────────────────────────┐
│              前端 (React + TypeScript)           │
│  ┌─────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ 文件列表  │ │ 书本式阅读器   │ │ 标签/搜索组件 │ │
│  │ (Virtual)│ │(SimpleText   │ │ (Ant Design) │ │
│  │          │ │ Reader核心)  │ │              │ │
│  └─────────┘ └──────┬───────┘ └──────────────┘ │
│                     │ Web Worker (文本预处理)    │
│              Tauri IPC (invoke + events)         │
├─────────────────────────────────────────────────┤
│              后端 (Rust)                         │
│  AppState: db / import / config                  │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐     │
│  │ 导入服务  │ │ 文件服务  │ │ 标签/维护服务 │     │
│  └─────────┘ └──────────┘ └──────────────┘     │
│              ┌──────────┐                       │
│              │  SQLite  │                       │
│              └──────────┘                       │
│  临时文件: 系统 temp_dir (退出时清理)            │
└─────────────────────────────────────────────────┘
```

### 7.2 Rust 全局状态管理

```rust
pub struct ImportState { pub running: bool; pub paused: bool; }
pub struct AppConfig { pub font_size: u32; pub word_wrap: bool; pub theme: String; }
pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub import: Mutex<ImportState>,
    pub config: Mutex<AppConfig>,
}
```

### 7.3 Tauri IPC 接口

```rust
// 文件库管理
async fn create_library(path, name, description) -> Result<(), String>;
async fn open_library(path, state) -> Result<LibraryInfo, String>;  // 仅验证 db_meta，不自动 integrity_check
async fn close_library(state) -> Result<(), String>;
async fn get_library_info(state) -> Result<LibraryInfo, String>;

// 文件操作
async fn list_files(filter, offset, limit, sort_by, sort_order, state) -> Result<FileListResult, String>;
async fn get_file_detail(id, state) -> Result<FileDetail, String>;
async fn delete_files(ids, state) -> Result<(), String>;
async fn export_files(ids, target_dir, encoding, state) -> Result<(), String>;
async fn update_description(id, description, state) -> Result<(), String>;

// 文件内容（阅读引擎用）
async fn get_file_content_for_reading(id, state) -> Result<FileReadingData, String>;
async fn save_reading_progress(id, last_read_line, state) -> Result<(), String>;
async fn get_file_preview(id, lines, state) -> Result<String, String>;

// 导入
async fn scan_import_path(path) -> Result<ScanResult, String>;
async fn start_import(path, options, app, state) -> Result<(), String>;
async fn pause_import / resume_import / cancel_import(state) -> Result<(), String>;

// 标签
async fn list_tags / create_tag / rename_tag / delete_tag / add_tags_to_files / remove_tags_from_files;

// 跨库
async fn move_files_to_library(file_ids, target_db_path, tag_mapping, state) -> Result<(), String>;
async fn copy_files_to_library(...);
async fn get_remote_tags(target_db_path) -> Result<Vec<TagInfo>, String>;

// 外部程序 + 维护
async fn open_with_external_app(id, reader_name, state) -> Result<(), String>;
async fn backup_library / check_integrity / optimize_database;
```

### 7.4 Tauri 事件

| 事件名 | 载荷 | 触发时机 |
|--------|------|---------|
| `import:progress` | `ImportProgress` | 每批次完成 |
| `import:complete` | `ImportSummary` | 导入完成 |
| `import:error` | `{ file, error }` | 单文件失败 |
| `db:integrity-done` | `IntegrityResult` | 校验完成 |

### 7.5 前端类型

```typescript
interface FileItem {
  id: number; filename: string; author: string; size: number;
  compressedSize: number; encoding: string; description: string;
  tags: string[]; lastReadLine: number; isRead: boolean; createdAt: string;
}

interface FileReadingData {
  id: number; content: string; encoding: string; filename: string; author: string;
}

interface ProcessedBook {
  htmlLines: string[]; titles: TitleEntry[]; pageBreaks: number[];
  footnotes: FootnoteEntry[]; isEasternLan: boolean; encoding: string;
}

interface TitleEntry {
  fullTitle: string; lineNumber: number; shortTitle: string; level: number;
}

interface SearchMatch {
  lineIndex: number; startChar: number; endChar: number;
}

interface SearchState {
  query: string; matches: SearchMatch[]; currentIndex: number;
  caseSensitive: boolean; wholeWord: boolean;
}

interface ImportOptions {
  batchSize: number; dedupStrategy: 'skip'|'overwrite'|'error';
  deleteAfterImport: boolean;
  filenameParser?: { enabled: boolean; patterns: Array<{ regex: string }>; stripExtension: boolean; defaultTags?: string[] };
}

interface FileFilter {
  filenameQuery?: string; authorQuery?: string; descriptionQuery?: string;
  tagIds?: number[]; tagFilterMode?: 'AND'|'OR';
  sizeRange?: [number, number]; dateRange?: [string, string]; encoding?: string;
}

interface ImportProgress {
  total: number; completed: number; currentFile: string;
  elapsed: number; estimatedRemaining: number; paused: boolean;
}
```

---

## 8. 快捷键

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| ← / → | 上一页 / 下一页 | 文本阅读 |
| Page Up / Page Down | 上一章 / 下一章 | 文本阅读 |
| Space | 向下滚动一屏 | 文本阅读 |
| Ctrl+F | 打开文内搜索栏 | 文本阅读 |
| Enter（搜索栏聚焦） | 下一个匹配结果 | 文本阅读 |
| Shift+Enter | 上一个匹配结果 | 文本阅读 |
| Escape（搜索栏打开） | 关闭搜索栏、清除高亮 | 文本阅读 |
| Ctrl++ / Ctrl+- | 放大/缩小字体 | 文本阅读 |
| Ctrl+0 | 重置字体大小 | 文本阅读 |
| Ctrl+C | 复制选中文本 | 文本阅读 |
| Ctrl+A | 全选 | 文件列表 |
| Ctrl+O | 打开文件库 | 全局 |
| Ctrl+N | 新建文件库 | 全局 |
| Ctrl+I | 导入文件 | 全局 |
| Ctrl+E | 导出选中文件 | 文件列表 |
| Ctrl+Shift+O | 用外部程序打开 | 文件列表 / 文本阅读 |
| Ctrl+S | 备份数据库 | 全局 |
| Delete | 删除选中文件 | 文件列表 |
| Escape | 关闭阅读/取消操作 | 全局 |
| Enter / 双击 | 打开阅读 | 文件列表 |

---

## 9. 项目结构

```
littlefile/
├── src-tauri/                          # Rust 后端
│   ├── Cargo.toml / tauri.conf.json
│   └── src/
│       ├── main.rs / lib.rs
│       ├── db/ { mod.rs, schema.rs, models.rs, migrations/ }
│       ├── commands/ { library.rs, files.rs, tags.rs, viewer.rs, import.rs, transfer.rs, maintenance.rs }
│       └── services/ { compression.rs, encoding.rs, hashing.rs, text_indexer.rs }
├── src/                                # React 前端
│   ├── App.tsx / main.tsx / index.css
│   ├── components/
│   │   ├── layout/ { AppLayout.tsx, Sidebar.tsx, StatusBar.tsx }
│   │   ├── library/ { LibraryList.tsx, LibraryToolbar.tsx, FileDetailPanel.tsx, FileContextMenu.tsx }
│   │   ├── viewer/ { FileViewer.tsx, ViewerToolbar.tsx, TOCPanel.tsx, PaginationBar.tsx, MetaPanel.tsx, Footnotes.tsx, SearchBar.tsx }
│   │   ├── tags/ { TagPanel.tsx, TagInput.tsx, TagFilter.tsx }
│   │   ├── search/ { SearchBox.tsx, FilterPanel.tsx }
│   │   ├── import/ { ImportDialog.tsx, ImportProgress.tsx }
│   │   └── common/ { ConfirmDialog.tsx, Notification.tsx }
│   ├── reader/                        # SimpleTextReader 核心引擎
│   │   ├── engine.ts / engine.worker.ts
│   │   ├── text-processor-core.js / pagination-calculator.js
│   │   ├── title-pattern-detector.js / regex-rules.js
│   │   ├── footnote-parser.js
│   │   └── adapters/ { jschardet.js, text-decoder.js }
│   ├── hooks/ { useLibrary.ts, useFiles.ts, useTags.ts, useViewer.ts, usePreview.ts, useExternalReader.ts, useImport.ts, useSearch.ts }
│   ├── services/ { tauri.ts }
│   ├── types/ { index.ts }
│   └── utils/ { format.ts }
├── package.json / tsconfig.json / vite.config.ts / index.html
└── REQUIREMENTS.md
```

---

## 10. 里程碑

### Phase 1：核心骨架（MVP）
**目标**：能导入文件、浏览列表、书本式阅读

| 任务 | 说明 |
|------|------|
| 项目脚手架 | Tauri 2 + React + Vite + Ant Design + TypeScript 初始化 |
| 数据库模块 | Schema 创建、连接管理、基础 CRUD、迁移框架 |
| 文件导入（基础） | 单文件/文件夹导入、编码检测、zlib 压缩、进度事件推送 |
| 文件列表 | 虚拟滚动列表、列排序、基础搜索（文件名）、状态栏统计 |
| 书本式阅读器 | SimpleTextReader 引擎提取、Web Worker 处理、React 组件渲染（TOC + 分页 + 正文）、大文件首屏秒开、阅读进度保存 |
| 文内搜索 | FR-7.5a（与 Phase 1 合并，阅读器核心功能） |
| 用外部程序打开 | tauri-plugin-opener、解压到临时文件、调用系统默认程序 |

### Phase 2：标签与搜索
| 任务 | 说明 |
|------|------|
| 标签 CRUD + 打标签 | 自动补全、批量打标签、标签面板 |
| 简介 + 组合筛选 | 编辑描述、模糊搜索、文件名+简介+标签联合筛选 |
| 文件预览面板 | 选中时显示前 20 行 |

### Phase 3：高级阅读功能
| 任务 | 说明 |
|------|------|
| 自定义字体 + 暗黑模式 | 3 个自定义 TTF/OTF、主题切换 |
| 脚注系统 + 阅读进度标记 | hover 弹窗、退出保存、已读完标记 |
| 导出/删除文件 | 单/批量、编码转换、确认对话框 |
| 高级筛选 | 文件大小、时间、作者、编码类型筛选 |

### Phase 4：跨库操作与维护
| 任务 | 说明 |
|------|------|
| 跨库移动/复制 | ATTACH DATABASE、标签映射对话框 |
| 备份/校验/优化/断点续传 | VACUUM INTO、integrity_check、ANALYZE |

### Phase 5：打磨与发布
| 任务 | 说明 |
|------|------|
| 应用设置 + 快捷键 + 窗口管理 | 配置持久化、主题、字体、位置记忆 |
| 安装包 + 错误处理 + 并发管控 | MSI/NSIS、全局错误捕获、导入中禁用写 |

---

## 附录 A：术语表

| 术语 | 定义 |
|------|------|
| 文件库 | 一个 SQLite 数据库文件（.db） |
| 文件 | 导入到库中的 txt 文本，存储为 zlib 压缩 BLOB |
| 标签 | 用户定义的分类标记，多对多关联文件 |
| 描述/简介 | 用户为文件附加的简短说明（≤500字） |
| 智能分页 | 优先在章节标题处断页，短章合并、长章拆分的分页算法 |
| 章节目录 (TOC) | 自动从文本中提取的标题列表，用于导航 |

## 附录 B：风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 175GB 数据库损坏 | 低 | 高 | 定期 VACUUM INTO 备份；WAL 模式降损 |
| 大文件阅读 OOM / 慢 | 低 | 中 | 分块处理 + 虚拟滚动 + Web Worker |
| 编码检测错误 | 中 | 低 | 导入时 jschardet + Rust charset 双重检测 |
| WebView2 兼容性 | 低 | 中 | Win10+ 均预装 |
| 导入时间过长 | 中 | 低 | 断点续传；异步导入；进度可视化 |
| SimpleTextReader 提取维护成本 | 低 | 中 | MIT 许可；核心模块稳定、低耦合 |

## 附录 C：未来可扩展方向（不在本期范围）
- 全文搜索（FTS5 集成）
- AI 摘要生成
- 文件内容去重检测
- 多用户/权限管理
- 云端同步
- 移动端阅读

## 附录 D：修订记录

| 版本 | 日期 | 修订内容 |
|------|------|---------|
| 1.0 | 2026-05-06 | 初始版本 |
| 1.1 | 2026-05-06 | P0-P3 12 项修订（大文件分块入 Phase 1、内存目标修订、导入事件、Schema 迁移、并发控制、状态管理、异步校验、跨库标签映射、offset/limit、Ant Design 按需、文件预览） |
| 1.2 | 2026-05-06 | 新增作者字段 + 文件名正则解析（FR-2.5） |
| 1.3 | 2026-05-06 | 新增外部程序打开（tauri-plugin-opener、FR-3.6/7.8/11.3） |
| 2.0 | 2026-05-06 | CodeMirror 6 → SimpleTextReader 书本式阅读引擎；重写 §3.7；新技术栈、UI、类型、Phase |
| 2.1 | 2026-05-06 | 新增文内搜索（FR-7.5a）：全文高亮、Enter 导航、匹配计数、区分大小写/全词匹配、跨页跳转 |
| 2.2 | 2026-05-06 | 新增 FR-1.5 文件库历史记录（最近打开 20 条、失效自动清理）；更新 FR-9.2/9.3 跨库操作支持从历史记录选择目标库 |
