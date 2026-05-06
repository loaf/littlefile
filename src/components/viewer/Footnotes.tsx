import { useState, useEffect } from 'react';
import { Tooltip } from 'antd';
import type { FootnoteEntry } from '../../reader/engine';

interface FootnotesProps { footnotes: FootnoteEntry[]; visibleLineRange: [number, number]; }

export default function Footnotes({ footnotes, visibleLineRange }: FootnotesProps) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!show || footnotes.length === 0) return null;

  const visibleFootnotes = footnotes.filter(f => f.lineNumber >= visibleLineRange[0] && f.lineNumber < visibleLineRange[1]);
  if (visibleFootnotes.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: 60, right: 20, zIndex: 1000, maxWidth: 360, maxHeight: 400, overflow: 'auto' }}>
      <Tooltip title="按 Esc 关闭" placement="left">
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>脚注 ({visibleFootnotes.length})</div>
          {visibleFootnotes.map((fn, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--highlight-text)', fontWeight: 600 }}>{fn.marker}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{fn.content}</span>
            </div>
          ))}
        </div>
      </Tooltip>
    </div>
  );
}
