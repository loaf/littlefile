import { useState } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { SafetyOutlined, ToolOutlined, SaveOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const { Text } = Typography;

interface IntegrityResult { ok: boolean; message: string; }

export default function MaintenancePanel() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const handleBackup = async () => {
    const selected = await open({ filters: [{ name: 'Database', extensions: ['db'] }] });
    if (!selected) return;
    try {
      await invoke('backup_library', { backupPath: selected });
      message.success('备份完成');
    } catch (e) { message.error(String(e)); }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const r = await invoke<IntegrityResult>('check_integrity');
      setResult(r);
      message.info(r.ok ? '数据库完整' : '发现问题');
    } catch (e) { message.error(String(e)); }
    finally { setChecking(false); }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      await invoke('optimize_database');
      message.success('优化完成');
    } catch (e) { message.error(String(e)); }
    finally { setOptimizing(false); }
  };

  return (
    <div style={{ padding: 16 }}>
      <Text strong style={{ marginBottom: 12, display: 'block' }}>数据库维护</Text>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button icon={<SaveOutlined />} onClick={handleBackup} block>备份数据库 (VACUUM INTO)</Button>
        <Button icon={<SafetyOutlined />} onClick={handleCheck} loading={checking} block>完整性校验</Button>
        {result && (
          <Text type={result.ok ? 'success' : 'danger'} style={{ fontSize: 12, padding: '0 8px' }}>
            {result.ok ? '✓ 完整' : `✗ ${result.message}`}
          </Text>
        )}
        <Button icon={<ToolOutlined />} onClick={handleOptimize} loading={optimizing} block>优化数据库 (ANALYZE)</Button>
      </Space>
    </div>
  );
}
