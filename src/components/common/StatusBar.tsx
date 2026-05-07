import { Space, Divider, Typography } from 'antd';

const { Text } = Typography;

interface StatusBarProps {
  libraryName: string;
  libraryPath: string;
  appVersion: string;
  totalFiles: number;
  totalSize: number;
  totalCompressedSize: number;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StatusBar({ libraryName, libraryPath, appVersion, totalFiles, totalSize, totalCompressedSize }: StatusBarProps) {
  const compressionRate = totalSize > 0
    ? Math.round((1 - totalCompressedSize / totalSize) * 100)
    : 0;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        padding: '6px 16px',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <Space split={<Divider type="vertical" />} size={8}>
        <Text strong style={{ fontSize: 12 }}>{libraryName}</Text>
        <Text type="secondary" style={{ fontSize: 11, maxWidth: 360 }} ellipsis>{libraryPath}</Text>
      </Space>
      <Space split={<Divider type="vertical" />} size={8}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {totalFiles} 个文件
        </Text>
        {totalSize > 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatBytes(totalSize)} / {formatBytes(totalCompressedSize)} ({compressionRate}%)
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 11 }}>
          v{appVersion}
        </Text>
      </Space>
    </div>
  );
}
