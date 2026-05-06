# LittleFile — OpenCode Development Prompts

> 基于 `REQUIREMENTS.md` v2.2 生成，可直接喂给 OpenCode 逐阶段执行。

---

## Phase 1: MVP — 导入、浏览、阅读

### 1.0 项目脚手架

**GOAL:** Initialize a Tauri 2.x + React 18 + TypeScript + Vite project with all dependencies.

**TASKS:**

1. Scaffold Tauri 2 project with React/TypeScript frontend template:
   - Run `npm create tauri-app@latest` with React + TypeScript + Vite
   - Project name: `littlefile`
   - Target directory: `D:\dev\littlefile`

2. Install frontend dependencies:
   ```bash
   npm install antd @ant-design/icons @tanstack/react-virtual
   npm install -D @types/react @types/react-dom unplugin-antd
   npm install @tauri-apps/plugin-shell @tauri-apps/plugin-opener
   ```

3. Install Rust dependencies — add to `src-tauri/Cargo.toml`:
   ```toml
   [dependencies]
   tauri-plugin-shell = "2"
   tauri-plugin-opener = "2"
   rusqlite = { version = "0.31", features = ["bundled"] }
   flate2 = "1"
   sha2 = "0.10"
   encoding_rs = "0.8"
   ```

4. Configure Vite (`vite.config.ts`):
   - Ant Design tree-shaking via `unplugin-antd`
   - Path alias: `@/` → `src/`

5. Configure Tauri (`tauri.conf.json`):
   - Window title: `"LittleFile"`
   - Window size: `1200x800`, min `900x600`
   - Enable `shell` and `opener` plugin permissions in `capabilities`

**MUST DO:**
- Verify `npm run tauri dev` launches the app successfully
- Verify the default React page renders in the Tauri window

**MUST NOT DO:**
- Start implementing features before the scaffold is verified working

---

### 1.1 数据库模块

**GOAL:** Create SQLite database schema, connection management, and migration framework in Rust.

**CONTEXT:** This is the data foundation. All subsequent phases depend on this.

**TASKS:**

1. **`src-tauri/src/db/schema.rs`** — Execute the DDL to create all tables:

   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA page_size = 16384;
   PRAGMA synchronous = NORMAL;
   PRAGMA cache_size = -32000;
   PRAGMA mmap_size = 67108864;

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

   Also create indexes:
   ```sql
   CREATE INDEX idx_files_filename   ON files(filename COLLATE NOCASE);
   CREATE INDEX idx_files_author     ON files(author COLLATE NOCASE);
   CREATE INDEX idx_files_sha256     ON files(sha256);
   CREATE INDEX idx_files_created_at ON files(created_at DESC);
   CREATE INDEX idx_file_tags_tag_id ON file_tags(tag_id, file_id);
   CREATE INDEX idx_tags_name        ON tags(name COLLATE NOCASE);
   ```

2. **`src-tauri/src/db/models.rs`** — Rust structs matching the tables:

   ```rust
   pub struct FileRecord {
       pub id: i64;
       pub filename: String;
       pub author: String;
       pub original_path: String;
       pub size: i64;
       pub compressed_size: i64;
       pub encoding: String;
       pub description: String;
       pub sha256: String;
       pub last_read_line: i64;
       pub is_read: bool;
       pub created_at: String;
       pub updated_at: String;
   }

   pub struct TagRecord {
       pub id: i64;
       pub name: String;
       pub created_at: String;
   }

   pub struct LibraryInfo {
       pub name: String;
       pub description: String;
       pub total_files: i64;
       pub total_size: i64;
       pub total_compressed_size: i64;
       pub total_tags: i64;
       pub db_file_size: i64;
       pub created_at: String;
   }
   ```

3. **`src-tauri/src/db/mod.rs`** — Database connection manager:
   - `fn open_database(path: &str) -> Result<Connection, Error>` — on open, verify `db_meta` table exists, check version, auto-run pending migrations
   - `fn close_database(conn: &mut Connection) -> Result<(), Error>` — WAL checkpoint on close

4. **`src-tauri/src/db/migrations/mod.rs`** — Migration registry:
   ```rust
   const MIGRATIONS: &[(i64, &str, fn(&Connection) -> Result<(), Error>)] = &[
       (2, "Add author column", v2::migrate),
       (3, "Add reading progress columns", v3::migrate),
   ];
   ```
   Each migration in its own file: `v2.rs` (`ALTER TABLE files ADD COLUMN author ...`), `v3.rs`

5. **`src-tauri/src/main.rs`** — AppState:
   ```rust
   use std::sync::Mutex;
   use rusqlite::Connection;

   pub struct AppState {
       pub db: Mutex<Option<Connection>>,
   }
   ```

**MUST DO:**
- All PRAGMAs applied at create time
- WAL mode enabled
- All indexes created

**MUST NOT DO:**
- Hard-code database paths without user selection
- Create tables without `IF NOT EXISTS` for migration safety

---

### 1.2 文件导入

**GOAL:** Implement batch file import: scan folder, detect encoding, compress with zlib, compute SHA-256, write to database with progress events.

**TASKS:**

1. **`src-tauri/src/services/encoding.rs`**:
   - `fn detect_encoding(path: &Path) -> Result<String, Error>` — use `encoding_rs` to read first 64KB and detect; return encoding name (e.g. `"UTF-8"`, `"GB2312"`)

2. **`src-tauri/src/services/compression.rs`**:
   - `fn compress_zlib(text: &str) -> Result<Vec<u8>, Error>` — use `flate2` with default compression level
   - `fn decompress_zlib(data: &[u8]) -> Result<String, Error>`

3. **`src-tauri/src/services/hashing.rs`**:
   - `fn sha256_hex(data: &[u8]) -> String`

4. **`src-tauri/src/commands/import.rs`** — Tauri commands:
   - `scan_import_path(path: String) -> ScanResult` — count `.txt` files recursively, total size, estimate time
   - `start_import(path, options, app, state)` — for each file: detect encoding → decode to UTF-8 → compress → SHA-256 → INSERT. Batch 500 files per transaction. After each batch: emit `import:progress` event. On completion: emit `import:complete`. On file error: emit `import:error` with `{ file, error }`, continue with next file.

5. **Frontend `src/components/import/ImportDialog.tsx`**:
   - Folder picker (Tauri dialog plugin) → on selection, call `scan_import_path` and display results
   - Start button calls `start_import`; monitor events `import:progress`, `import:error`, `import:complete`
   - Progress bar with file count, percentage, elapsed/remaining time
   - Pause/Cancel buttons call `pause_import` / `cancel_import`

**Tauri Events** (emit from Rust):
- `import:progress`: `{ total, completed, current_file, elapsed, estimated_remaining, paused }`
- `import:error`: `{ file, error }`
- `import:complete`: summary struct

**ImportOptions** (from frontend):
- `batch_size: number` (default 500)
- `dedup_strategy: "skip" | "overwrite" | "error"`
- `delete_after_import: boolean`

**MUST DO:**
- Progress events pushed after each batch
- SHA-256 computed on original (pre-compression) content
- Original encoding stored in `files.encoding`
- Content stored as zlib-compressed BLOB in `files.content`

**MUST NOT DO:**
- Import without transaction batching (one file per commit is too slow)
- Skip encoding detection (assume UTF-8)
- Block UI during import (use async + events)

---

### 1.3 文件列表

**GOAL:** Display a virtual-scrolled file list with filename, author, size, description, tags, encoding, import time columns.

**TASKS:**

1. **`src-tauri/src/commands/files.rs`** — `list_files` command:
   ```rust
   async fn list_files(
       filter: FileFilter,
       offset: i64,
       limit: i64,
       sort_by: String,
       sort_order: String,
       state: State<'_, AppState>
   ) -> Result<FileListResult, String>;
   ```
   - Build SQL dynamically from filter fields (`filename_query`, `author_query`, `description_query`)
   - JOIN `file_tags` + `tags` if `tag_ids` filter provided
   - Support `sort_by`: `"filename"`, `"author"`, `"size"`, `"created_at"`
   - Result includes: `total_count`, `files` array with tags joined as comma-separated string

2. **Frontend `src/components/library/LibraryList.tsx`**:
   - Use `@tanstack/react-virtual` for 100K+ row virtual scrolling
   - Columns: 文件名, 作者, 大小 (formatBytes), 描述, 标签 (chip), 编码, 导入时间
   - Click column header → sort (asc/desc toggle)
   - Click row: single = preview, double = open reader
   - Multi-select: Ctrl+Click, Shift+Click, Ctrl+A

3. **Frontend `src/hooks/useFiles.ts`**: manages filter/sort/offset state; calls `list_files` on change; infinite scroll (increment offset at bottom)

4. **Frontend `src/components/common/StatusBar.tsx`**: shows `"共 N 个文件 | 已选 M 个 | 压缩率 X% | 数据库 Y GB"`

5. **Frontend `src/components/layout/Sidebar.tsx`**: left sidebar with tag filter panel (placeholder for Phase 2), "全部" entry

**FileFilter interface:**
```typescript
interface FileFilter {
  filenameQuery?: string;
  authorQuery?: string;
  descriptionQuery?: string;
  tagIds?: number[];
  tagFilterMode?: 'AND' | 'OR';
}
```

**MUST DO:**
- Virtual scrolling renders only visible rows
- Human-readable file sizes (KB/MB/GB)
- Loading indicator while fetching

**MUST NOT DO:**
- Load all 100K rows into DOM
- Execute SQL with unsanitized inputs (use parameterized queries)

---

### 1.4 书本式阅读器

**GOAL:** Replaced CodeMirror 6 with a book-style reader powered by SimpleTextReader's core text processing engine. Supports TOC, smart pagination, footnotes, reading progress.

**CONTEXT:** The reading engine is extracted from [SimpleTextReader](https://github.com/henryxrl/SimpleTextReader) (MIT). Only the text processing core is reused — all UI is rewritten as React components. MUST handle 50MB files with sub-2s first-screen load.

**TASKS:**

1. **Extract SimpleTextReader core modules** — copy to `src/reader/`:
   - From `shared/core/text/`: `text-processor-core.js`, `pagination-calculator.js`, `title-pattern-detector.js`, `regex-rules.js`, `bracket-processor.js`, `footnote-parser.js`
   - From `shared/adapters/`: `jschardet.js`, `text-decoder.js`
   - Create **`src/reader/engine.ts`** — TypeScript wrapper:
     ```typescript
     interface ProcessedBook {
       htmlLines: string[];          // processed HTML lines
       titles: TitleEntry[];        // { fullTitle, lineNumber, shortTitle, level }
       pageBreaks: number[];        // line indices where pages break
       footnotes: FootnoteEntry[];
       isEasternLan: boolean;
       encoding: string;
     }
     function processText(content: string, encoding: string): ProcessedBook;
     ```
   - **`src/reader/engine.worker.ts`** — Web Worker entry calling `processText()` off main thread

2. **Rust backend commands:**
   - `get_file_content_for_reading(id: i64, state)` → decompress from SQLite, return `{ id, content, encoding, filename, author }`
   - `save_reading_progress(id: i64, last_read_line: i64, state)` → `UPDATE files SET last_read_line = ?, is_read = CASE WHEN ... END`
   - `get_file_preview(id: i64, lines: i64, state)` → decompress, return first N lines

3. **React components:**
   - **`src/components/viewer/FileViewer.tsx`** — main reader: receives fileId → calls `get_file_content_for_reading` → spawns Web Worker → renders sub-components; loads animated SVG spinner during processing
   - **`src/components/viewer/TOCPanel.tsx`** — table of contents sidebar: lists titles with indentation by level; current chapter highlighted; click jumps to page
   - **`src/components/viewer/PaginationBar.tsx`** — bottom nav: "← 上一页 第 X / Y 页 下一页 →" + page jump input + background processing indicator
   - **`src/components/viewer/MetaPanel.tsx`** — right sidebar: filename, author, size, encoding, tags (editable), description (editable)
   - **`src/components/viewer/Footnotes.tsx`** — hover tooltip on ① markers

4. **Large file optimization:** if content > 1MB: process first 1MB immediately (sub-second first screen), then background-process remaining; show progress indicator in pagination bar

5. **`src/hooks/useViewer.ts`**: manages fileId, ProcessedBook state, currentPage, loading; `goToPage()` / `goToNextChapter()` / `goToPrevChapter()`; on unmount → `save_reading_progress`

**MUST DO:**
- Web Worker for text processing (never block UI thread)
- Smart pagination: break at chapter titles, merge short chapters, split long ones
- 50MB file first screen < 2s
- Reading progress auto-saved on close

**MUST NOT DO:**
- Import SimpleTextReader's bookshelf, server, fontpool, or extension code
- Use CodeMirror 6 for reading (completely replaced)
- Load entire 50MB into DOM (page-based rendering only)

---

### 1.5 文内搜索

**GOAL:** Full-text search within the reading view: highlight all matches, Enter/Shift+Enter navigation, match count, case/word toggles, cross-page jumping.

**CONTEXT:** Works on `ProcessedBook.htmlLines` array (not DOM). Runs in main thread (< 200ms for 50MB / ~1M lines).

**TASKS:**

1. **`src/hooks/useSearch.ts`** — search state and logic:
   - State: `{ query, matches: SearchMatch[], currentIndex, caseSensitive, wholeWord }`
   - On query change: iterate `htmlLines` with `indexOf`, collect all `{ lineIndex, startChar, endChar }`
   - `goToNextMatch()`: increment `currentIndex`, scroll to match, cross-page if needed
   - `goToPrevMatch()`: decrement `currentIndex`
   - `clearSearch()`: reset all state

2. **`src/components/viewer/SearchBar.tsx`**:
   - Renders at top of reading view when visible (Ctrl+F toggles)
   - Input field + `"第 N / M 个"` counter + `[Aa]` case toggle + `[ab]` whole-word toggle + `[×]` close
   - Large file still processing: show `"正在处理全文，搜索结果可能不完整"`
   - No results: show `"无匹配结果"`

3. **Modify `FileViewer.tsx`** for highlight rendering:
   - Before rendering current page, check if matches fall within visible line range
   - Matching text → `<mark class="search-highlight">` (yellow `#FFEB3B`)
   - Current active match → `<mark class="search-active">` (orange `#FF9800`)
   - Auto-scroll to make current match visible

**TypeScript types:**
```typescript
interface SearchMatch { lineIndex: number; startChar: number; endChar: number; }
interface SearchState {
  query: string; matches: SearchMatch[]; currentIndex: number;
  caseSensitive: boolean; wholeWord: boolean;
}
```

**MUST DO:**
- Search on `htmlLines` text (not DOM `textContent`)
- Enter = next match, Shift+Enter = prev match
- Auto-advance to next page when no more matches on current page
- ESC or × clears search and removes all highlights

**MUST NOT DO:**
- Use browser's native Ctrl+F (custom implementation only)
- Re-process the file for each search query
- Block UI during search

---

### 1.6 外部程序打开

**GOAL:** Open file with system default program or user-configured reader. Export compressed content to temp file, invoke via `tauri-plugin-opener`.

**TASKS:**

1. **Rust command** `open_with_external_app(id, reader_name, state)`:
   - Decompress from DB, write to `std::env::temp_dir() / "littlefile" / filename`
   - If `reader_name` is `Some`: find configured path, use `opener::open_with(path, reader_path)`
   - If `reader_name` is `None`: use `opener::open(path)` for system default
   - Cleanup temp files on app exit

2. **Configure external readers** in app settings (Tauri Store / config JSON):
   - Array of `{ name: string, path: string, preferred: boolean }`
   - Validate path existence on startup; mark missing as unavailable

3. **Frontend**:
   - Right-click menu in file list: "用系统默认程序打开" / "用 {reader name} 打开"
   - Toolbar button in reading view: same options
   - `Ctrl+Shift+O` shortcut for preferred reader or system default

**MUST DO:**
- Temp files cleaned up on app exit
- Configurable external reader paths
- Graceful error if reader not installed

**MUST NOT DO:**
- Leave temp files after app closes

---

## Phase 2: 标签与搜索

**GOAL:** Add tag CRUD, file tagging with autocomplete, description editing, and combined search/filter.

**CONTEXT:** Phase 1 file list and reader are working. Now add metadata management.

**TASKS:**

1. **Rust commands for tags:**
   - `list_tags(state) -> Vec<TagInfo>` (includes `file_count` per tag)
   - `create_tag(name, state) -> TagInfo`
   - `rename_tag(id, new_name, state) -> Result<(), String>`
   - `delete_tag(id, state) -> Result<(), String>`
   - `add_tags_to_files(file_ids, tag_ids, state) -> Result<(), String>`
   - `remove_tags_from_files(file_ids, tag_ids, state) -> Result<(), String>`

2. **Frontend tag components:**
   - **`src/components/tags/TagPanel.tsx`** — sidebar panel with tag list, each showing file count, click to filter
   - **`src/components/tags/TagInput.tsx`** — autocomplete input for adding tags (filters existing tags as you type)
   - **`src/components/tags/TagFilter.tsx`** — AND/OR toggle for multi-tag filtering

3. **Description editing:**
   - Rust: `update_description(id, description, state)`
   - Frontend: inline editing in file list (click description cell) and in `MetaPanel` during reading

4. **Combined search:**
   - `src/hooks/useFiles.ts`: add `tag_ids` and `tagFilterMode` to `FileFilter`
   - Update `list_files` Rust command to handle tag JOINs with AND/OR logic
   - Clear all filters button

5. **File preview panel (FR-3.5):**
   - Bottom panel in main view showing first 20 lines of selected file
   - Calls `get_file_preview` Rust command; collapsible toggle

**MUST DO:**
- Tag names case-insensitive unique (`COLLATE NOCASE`)
- Tag autocomplete shows existing tags as you type
- Combined search = all criteria AND together

**MUST NOT DO:**
- Preload full file content for preview (only 20 lines)

---

## Phase 3: 高级阅读功能

**GOAL:** Custom fonts, dark mode, footnote polish, reading progress UI, export/delete, advanced filters.

**CONTEXT:** Phase 1-2 features are stable. Now polish the reading experience.

**TASKS:**

1. **Custom fonts:** allow upload of up to 3 TTF/OTF font files (stored in app config dir); font select dropdown in reading toolbar; validate font files on upload (check magic bytes)

2. **Dark mode:** toggle in settings/toolbar/system-follow; CSS variables for light/dark theme, all components respect theme; SimpleTextReader reader CSS adapted for dark mode

3. **Footnote polish:** already extracted in Phase 1.4; add hover tooltip with Tippy.js, keyboard dismiss with Esc

4. **Reading progress UI:** save `last_read_line` on close (Phase 1.4); restore on open: auto-jump to saved line; visual indicator: read vs unread icon in file list; "mark as read" when reaching last page

5. **Export files:** Rust `export_files(ids, target_dir, encoding)`; options: original encoding / UTF-8 / as-is; progress bar for batch export

6. **Delete files:** single and batch delete with confirmation dialog; cascade delete tags association

7. **Advanced filters:** file size range slider, import date range, author filter, encoding filter, "has description" / "has tags" toggles

**MUST DO:**
- Dark mode applies to ALL views (list, reader, settings)
- Export respects original encoding option
- Delete requires confirmation

**MUST NOT DO:**
- Hard-code light theme colors (use CSS variables)
- Delete without cascade cleanup of `file_tags`

---

## Phase 4: 跨库操作与维护

**GOAL:** Multi-library with history, cross-library move/copy with tag mapping, backup/integrity/optimize.

**CONTEXT:** Core single-library features are complete. Now add library management.

**TASKS:**

1. **Library history (FR-1.5):**
   - Store opened library paths in app config (max 20, sorted by last open time)
   - Display in "最近打开" dropdown in toolbar
   - On click: check `std::fs::metadata` — if not exists → alert + auto-remove from history

2. **Open multiple libraries:** tab-based interface; each tab has independent file list, tags, search state

3. **Cross-library move/copy:**
   - Right-click → "移动到/复制到" → target library selector (history list + "浏览..." button)
   - After target selected: **tag mapping dialog** — for each source tag, user picks: map to existing target tag / create new / skip; "一键映射" button for auto-mapping by name
   - Execute: `ATTACH` target database → `INSERT` files + tags → verify → `DETACH` → `DELETE` from source (move only)

4. **Database maintenance:**
   - `backup_library`: `VACUUM INTO` with user-chosen path
   - `check_integrity`: `PRAGMA integrity_check`, async with progress event
   - `optimize_database`: `PRAGMA optimize` + `ANALYZE`
   - Import resume: store checkpoint in `db_meta`, offer resume on re-import

**MUST DO:**
- `ATTACH`/`DETACH` for cross-library operations
- Tag mapping dialog before executing move/copy
- Library history auto-cleans broken entries

**MUST NOT DO:**
- Move/copy without tag mapping confirmation
- Leave database `ATTACH`ed after operation

---

## Phase 5: 打磨与发布

**GOAL:** Settings persistence, keyboard shortcuts, window management, installer packaging, error handling, concurrency control.

**TASKS:**

1. **Settings persistence:** Tauri Store plugin for app config; settings page: font, font size, theme, language, default library path, import batch size; window position/size saved and restored

2. **Keyboard shortcuts:** global shortcuts registered via Tauri or React listeners; full list from `REQUIREMENTS.md` §8; shortcuts displayed in tooltips

3. **Window management:** remember window position/size; restore on launch; minimum size constraint

4. **Installer packaging:** NSIS or MSI for Windows; portable version (zip); installer < 15MB; icon generation (512px PNG, `.ico`)

5. **Error handling:** global React error boundary; Rust errors → human-readable Chinese messages; toast for non-critical errors, dialog for critical errors

6. **Concurrency control:**
   - During import: disable tag edit, file delete, description edit (grey out + tooltip "导入进行中，请稍后")
   - Read operations (search, list, read) remain available during import
   - `busy_timeout` for write operation queuing

**MUST DO:**
- All user-facing messages in Chinese
- Error messages explain what happened, not raw stack traces
- Window state persists across sessions

**MUST NOT DO:**
- Ship debug builds as release
- Include dev dependencies in installer

---

## 通用约束（所有 Phase 适用）

**MUST ALWAYS:**
- Use TypeScript strict mode
- Use parameterized SQL queries (never string concatenation)
- Follow existing code patterns within the project
- Run `cargo check` and `npm run build` after each significant change
- Update the todo list as you work

**MUST NEVER:**
- Use `as any` or `@ts-ignore` or `@ts-expect-error`
- Leave unused imports or dead code
- Commit to git without user permission
- Skip error handling with empty catch blocks `catch(e) {}`
- Use `background_cancel(all=true)` — always cancel individual tasks by ID

**FILE ORGANIZATION:**
- Rust: `src-tauri/src/commands/` for Tauri commands, `src-tauri/src/services/` for business logic, `src-tauri/src/db/` for database
- React: `src/components/` for UI, `src/hooks/` for state, `src/reader/` for reading engine, `src/types/` for TypeScript types

---

## 如何使用此文件

每次喂给 OpenCode 一个 Phase（先 Phase 1.0，成功后继续 1.1，以此类推）：

```
请执行 PROMPTS.md 中的 Phase 1.0，搭建项目脚手架。
完成后不要继续后续 Phase，等待我确认。
```

每个 Phase 完成后，验证标准：
- `cargo check` 无错误
- `npm run build` 无错误
- 目标功能手动测试通过
