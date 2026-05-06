import { Collapse, Slider, DatePicker, Select, Switch, Space, Typography, Button } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import type { FileFilter } from '../../hooks/useFiles';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface FilterPanelProps { filter: FileFilter; onFilterChange: (f: FileFilter) => void; }

export default function FilterPanel({ filter, onFilterChange }: FilterPanelProps) {
  const hasAdvanced = !!(filter.sizeMin || filter.sizeMax || filter.dateFrom || filter.dateTo || filter.encodingFilter || filter.hasDescription !== undefined || filter.hasTags !== undefined);

  const handleClear = () => onFilterChange({ ...filter, sizeMin: undefined, sizeMax: undefined, dateFrom: undefined, dateTo: undefined, encodingFilter: undefined, hasDescription: undefined, hasTags: undefined });

  return (
    <Collapse ghost size="small" items={[{ key: 'filters', label: <Space size={4}><FilterOutlined /><Text strong style={{ fontSize: 12 }}>高级筛选</Text>{hasAdvanced && <ClearOutlined style={{ fontSize: 10, color: 'var(--highlight-text)' }} />}</Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><Text style={{ fontSize: 11 }}>文件大小范围 (MB)</Text>
            <Slider range min={0} max={50} step={1}
              value={[filter.sizeMin ? filter.sizeMin / 1e6 : 0, filter.sizeMax ? filter.sizeMax / 1e6 : 50]}
              onChange={([min, max]) => onFilterChange({ ...filter, sizeMin: min * 1e6, sizeMax: max * 1e6 })}
              marks={{ 0: '0', 25: '25', 50: '50' }} /></div>
          <div><Text style={{ fontSize: 11 }}>导入时间范围</Text>
            <RangePicker size="small" style={{ width: '100%' }}
              onChange={(dates) => onFilterChange({ ...filter, dateFrom: dates?.[0]?.format('YYYY-MM-DD'), dateTo: dates?.[1]?.format('YYYY-MM-DD') })} /></div>
          <div><Text style={{ fontSize: 11 }}>编码</Text>
            <Select size="small" style={{ width: '100%' }} allowClear value={filter.encodingFilter}
              onChange={(v) => onFilterChange({ ...filter, encodingFilter: v || undefined })}
              options={[{ label: 'UTF-8', value: 'utf-8' }, { label: 'GBK', value: 'gbk' }, { label: 'GB18030', value: 'gb18030' }, { label: 'Big5', value: 'big5' }]} /></div>
          <Space><Switch size="small" checked={filter.hasTags ?? false} onChange={(v) => onFilterChange({ ...filter, hasTags: v || undefined })} /><Text style={{ fontSize: 11 }}>有标签</Text></Space>
          <Space><Switch size="small" checked={filter.hasDescription ?? false} onChange={(v) => onFilterChange({ ...filter, hasDescription: v || undefined })} /><Text style={{ fontSize: 11 }}>有描述</Text></Space>
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>清除筛选</Button>
        </div>
      ),
    }]} />
  );
}
