import { useEffect, useRef } from 'react';
import { Input, Button, Space, Typography, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { CloseOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface SearchBarProps {
  query: string;
  matchCount: number;
  currentIndex: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  processing: boolean;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleCase: () => void;
  onToggleWord: () => void;
  onClose: () => void;
}

export default function SearchBar({
  query, matchCount, currentIndex, caseSensitive, wholeWord, processing,
  onQueryChange, onNext, onPrev, onToggleCase, onToggleWord, onClose,
}: SearchBarProps) {
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderBottom: '1px solid var(--border-color)',
      background: 'var(--search-bar-bg)', flexShrink: 0,
    }}>
      <Input
        ref={inputRef}
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onNext(); }
          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onPrev(); }
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        }}
        placeholder="搜索..."
        size="small"
        style={{ width: 280 }}
        suffix={
          <Space size={2}>
            {query && !processing && matchCount > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {currentIndex + 1}/{matchCount}
              </Text>
            )}
            {query && !processing && matchCount === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>无匹配结果</Text>
            )}
            {processing && query && (
              <Text type="secondary" style={{ fontSize: 12 }}>处理中...</Text>
            )}
          </Space>
        }
      />

      <Space.Compact>
        <Tooltip title="上一个 (Shift+Enter)">
          <Button size="small" icon={<ArrowUpOutlined />} onClick={onPrev} disabled={matchCount === 0} />
        </Tooltip>
        <Tooltip title="下一个 (Enter)">
          <Button size="small" icon={<ArrowDownOutlined />} onClick={onNext} disabled={matchCount === 0} />
        </Tooltip>
      </Space.Compact>

      <Tooltip title="区分大小写">
        <Button size="small" type={caseSensitive ? 'primary' : 'default'} onClick={onToggleCase}>
          Aa
        </Button>
      </Tooltip>

      <Tooltip title="全词匹配">
        <Button size="small" type={wholeWord ? 'primary' : 'default'} onClick={onToggleWord}>
          ab
        </Button>
      </Tooltip>

      <Tooltip title="关闭 (Esc)">
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
      </Tooltip>
    </div>
  );
}
