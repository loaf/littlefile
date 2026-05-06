import { useState } from 'react';
import { Button, Typography } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { TitleEntry } from '../../reader/engine';

const { Text } = Typography;

interface TOCPanelProps {
  titles: TitleEntry[];
  currentLine: number;
  onTitleClick: (title: TitleEntry) => void;
}

export default function TOCPanel({ titles, currentLine, onTitleClick }: TOCPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          height: '100%',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 12,
          flexShrink: 0,
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<MenuUnfoldOutlined />}
          onClick={() => setCollapsed(false)}
        />
      </div>
    );
  }

  // Determine current chapter: last title whose lineNumber <= currentLine
  let currentChapterLine = -1;
  for (let i = titles.length - 1; i >= 0; i--) {
    if (titles[i].lineNumber <= currentLine) {
      currentChapterLine = titles[i].lineNumber;
      break;
    }
  }

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 13 }}>目录</Text>
        <Button
          type="text"
          size="small"
          icon={<MenuFoldOutlined />}
          onClick={() => setCollapsed(true)}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {titles.length === 0 && (
          <Text type="secondary" style={{ display: 'block', padding: '12px 16px', fontSize: 12 }}>
            未检测到章节
          </Text>
        )}
        {titles.map((title) => {
          const isActive = title.lineNumber === currentChapterLine;
          return (
            <div
              key={title.lineNumber}
              onClick={() => onTitleClick(title)}
              style={{
                paddingLeft: 12 + (title.level - 1) * 16,
                paddingRight: 12,
                paddingTop: 6,
                paddingBottom: 6,
                cursor: 'pointer',
                background: isActive ? 'var(--highlight-bg)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                lineHeight: '20px',
              }}
            >
              <Text
                ellipsis
                style={{
                  fontWeight: 'inherit',
                   color: isActive ? 'var(--highlight-text)' : undefined,
                  fontSize: 'inherit',
                }}
              >
                {title.shortTitle}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}
