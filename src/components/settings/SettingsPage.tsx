import { InputNumber, Select, Button, Typography, Divider, Space, Input } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';

const { Text, Title } = Typography;

interface SettingsPageProps { onClose?: () => void; }

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>应用设置</Title>

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>阅读设置</Text>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>字体大小</Text>
            <InputNumber value={settings.fontSize} onChange={v => updateSettings({ fontSize: v ?? 14 })} min={10} max={24} step={1} addonAfter="px" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>默认字体</Text>
            <Select value={settings.fontFamily} onChange={v => updateSettings({ fontFamily: v })} style={{ width: 160 }}
              options={[
                { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
                { label: '宋体', value: 'SimSun, serif' },
                { label: '楷体', value: 'KaiTi, serif' },
                { label: '黑体', value: 'SimHei, sans-serif' },
              ]} />
          </div>
        </Space>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>外观</Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>暗色模式</Text>
          <Button size="small" onClick={toggleTheme}>
            {theme === 'light' ? '切换暗色' : '切换亮色'}
          </Button>
        </div>
      </div>

      <Divider />

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>导入设置</Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text>默认库路径</Text>
          <Input value={settings.defaultLibraryPath} onChange={e => updateSettings({ defaultLibraryPath: e.target.value })} placeholder="留空使用默认" style={{ width: 200 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>批量大小</Text>
          <InputNumber value={settings.importBatchSize} onChange={v => updateSettings({ importBatchSize: v ?? 500 })} min={100} max={2000} step={100} />
        </div>
      </div>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button icon={<ReloadOutlined />} onClick={resetSettings}>恢复默认</Button>
        {onClose && <Button type="primary" icon={<SaveOutlined />} onClick={onClose}>完成</Button>}
      </Space>
    </div>
  );
}
