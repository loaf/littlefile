import { Space, Divider, Typography } from 'antd';

const { Text } = Typography;

interface StatusBarProps {
  totalFiles: number;
  selectedCount: number;
  totalSize: number;
  totalCompressedSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StatusBar({ totalFiles, selectedCount, totalSize, totalCompressedSize }: StatusBarProps) {
  const compressionRate = totalSize > 0
    ? Math.round((1 - totalCompressedSize / totalSize) * 100)
    : 0;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        padding: '8px 16px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Space split={<Divider type="vertical" />} size={4}>
        <Text type="secondary">
          共 {totalFiles} 个文件
        </Text>
        {selectedCount > 0 && (
          <Text type="secondary">
            已选 {selectedCount} 个
          </Text>
        )}
        {totalSize > 0 && (
          <Text type="secondary">
            压缩率 {compressionRate}% | {formatBytes(totalSize)} / {formatBytes(totalCompressedSize)}
          </Text>
        )}
      </Space>
    </div>
  );
}
