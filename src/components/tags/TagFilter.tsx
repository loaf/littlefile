import { Radio, Typography, Space } from 'antd';

const { Text } = Typography;

interface TagFilterProps {
  mode: 'AND' | 'OR';
  onChange: (mode: 'AND' | 'OR') => void;
}

export default function TagFilter({ mode, onChange }: TagFilterProps) {
  return (
    <div style={{ padding: '4px 0' }}>
      <Space>
        <Text type="secondary" style={{ fontSize: 11 }}>筛选模式:</Text>
        <Radio.Group
          size="small"
          value={mode}
          onChange={e => onChange(e.target.value)}
        >
          <Radio.Button value="OR" style={{ fontSize: 11, padding: '0 8px' }}>或</Radio.Button>
          <Radio.Button value="AND" style={{ fontSize: 11, padding: '0 8px' }}>且</Radio.Button>
        </Radio.Group>
      </Space>
    </div>
  );
}
