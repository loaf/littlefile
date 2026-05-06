export interface TitleEntry {
  fullTitle: string;
  lineNumber: number;
  shortTitle: string;
  level: number;
}

export interface FootnoteEntry {
  index: number;
  marker: string;
  content: string;
  lineNumber: number;
}

export interface ProcessedBook {
  htmlLines: string[];
  titles: TitleEntry[];
  pageBreaks: number[];
  footnotes: FootnoteEntry[];
  isEasternLan: boolean;
  encoding: string;
}

/**
 * Placeholder implementation. The actual implementation will import SimpleTextReader core modules.
 * Processes raw text into a ProcessedBook with HTML lines, titles, page breaks, and footnotes.
 */
export function processText(content: string, encoding: string): ProcessedBook {
  const lines = content.split('\n');
  const htmlLines: string[] = new Array(lines.length);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      htmlLines[i] = '<p class="empty-line">&nbsp;</p>';
    } else if (/^第[一二三四五六七八九十百千0-9]+[章节].*$/.test(trimmed)) {
      htmlLines[i] = `<h2 class="chapter-title">${escapeHtml(trimmed)}</h2>`;
    } else if (/^[一二三四五六七八九十]+\s*[、，]/.test(trimmed)) {
      htmlLines[i] = `<h3 class="section-title">${escapeHtml(trimmed)}</h3>`;
    } else {
      htmlLines[i] = `<p>${escapeHtml(trimmed)}</p>`;
    }
  }

  const titles: TitleEntry[] = [];
  for (let i = 0; i < htmlLines.length; i++) {
    const html = htmlLines[i];
    if (html.includes('chapter-title') || html.includes('section-title')) {
      const text = stripHtml(html);
      titles.push({
        fullTitle: text,
        lineNumber: i,
        shortTitle: text.length > 20 ? text.slice(0, 20) + '...' : text,
        level: html.includes('chapter-title') ? 1 : 2,
      });
    }
  }

  // Simple pagination: ~50 lines per page for Chinese, ~40 for Eastern
  const isEasternLan = /[\u4e00-\u9fff]/.test(content.slice(0, 1000));
  const linesPerPage = isEasternLan ? 50 : 40;
  const pageBreaks: number[] = [];
  for (let i = linesPerPage; i < htmlLines.length; i += linesPerPage) {
    // Try to find a title near the break point to align pages with chapters
    const lookAhead = Math.min(i + 20, htmlLines.length);
    let breakPoint = i;
    for (let j = i; j < lookAhead; j++) {
      if (htmlLines[j].includes('chapter-title')) {
        breakPoint = j;
        break;
      }
    }
    pageBreaks.push(breakPoint);
  }

  // Detect footnotes (①-㊿ markers)
  const footnotes: FootnoteEntry[] = [];
  for (let i = 0; i < htmlLines.length; i++) {
    const match = htmlLines[i].match(/([①-⑳㉑-㊿])\s*(.+)/);
    if (match) {
      footnotes.push({
        index: footnotes.length,
        marker: match[1],
        content: match[2],
        lineNumber: i,
      });
    }
  }

  return {
    htmlLines,
    titles,
    pageBreaks,
    footnotes,
    isEasternLan,
    encoding,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
