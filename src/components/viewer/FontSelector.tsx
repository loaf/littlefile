import { Select } from 'antd';

const BUILT_IN_FONTS = [
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '等线', value: 'DengXian, sans-serif' },
];

interface FontSelectorProps { value: string; onChange: (font: string) => void; }

export default function FontSelector({ value, onChange }: FontSelectorProps) {
  return <Select value={value} onChange={onChange} options={BUILT_IN_FONTS} size="small" style={{ width: 110 }} />;
}
