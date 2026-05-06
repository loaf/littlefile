import { InputNumber, Button, Space, Typography } from 'antd';

const { Text } = Typography;

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  processing: boolean;
  onPageChange: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function PaginationBar({
  currentPage,
  totalPages,
  processing,
  onPageChange,
  onPrevPage,
  onNextPage,
}: PaginationBarProps) {
  const handleJump = (value: number | null) => {
    if (value !== null && value >= 1 && value <= totalPages) {
      onPageChange(value - 1);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 16px',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <Button
        size="small"
        disabled={currentPage === 0}
        onClick={onPrevPage}
      >
        ← 上一页
      </Button>

      <Space size={6} align="center">
        <InputNumber
          size="small"
          min={1}
          max={totalPages}
          value={currentPage + 1}
          onChange={handleJump}
          onPressEnter={(e) => {
            const input = e.target as HTMLInputElement;
            const val = Number(input.value);
            if (val >= 1 && val <= totalPages) {
              onPageChange(val - 1);
            }
          }}
          onBlur={() => {
            handleJump(currentPage + 1);
          }}
          style={{ width: 64 }}
        />
        <Text type="secondary" style={{ fontSize: 13 }}>
          / {totalPages} 页
        </Text>
      </Space>

      <Button
        size="small"
        disabled={currentPage >= totalPages - 1}
        onClick={onNextPage}
      >
        下一页 →
      </Button>

      {processing && (
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 16 }}>
          后台处理中...
        </Text>
      )}
    </div>
  );
}
