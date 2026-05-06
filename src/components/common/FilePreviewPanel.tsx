import { useState, useEffect } from 'react';
import { Collapse, Typography, Skeleton } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

const { Text } = Typography;

interface FilePreviewPanelProps {
  fileId: number | null;
  filename: string;
}

export default function FilePreviewPanel({ fileId, filename }: FilePreviewPanelProps) {
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!fileId || !open) return;
    setLoading(true);
    invoke<string>('get_file_preview', { id: fileId, lines: 20 })
      .then(setPreview)
      .catch((err) => {
        console.error('Preview failed:', err);
        setPreview('加载预览失败');
      })
      .finally(() => setLoading(false));
  }, [fileId, open]);

  if (!fileId) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      padding: '4px 16px',
      flexShrink: 0,
    }}>
      <Collapse
        ghost
        size="small"
        activeKey={open ? ['preview'] : []}
        onChange={(keys) => setOpen(keys.length > 0)}
        items={[{
          key: 'preview',
          label: (
            <Text style={{ fontSize: 13 }}>
              <EyeOutlined style={{ marginRight: 8 }} />
              预览: {filename}
            </Text>
          ),
          children: loading
            ? <Skeleton active paragraph={{ rows: 3 }} />
            : (
              <pre style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.6,
                maxHeight: 200,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-primary)',
                padding: 8,
                borderRadius: 4,
              }}>
                {preview || '(空文件)'}
              </pre>
            ),
        }]}
      />
    </div>
  );
}
