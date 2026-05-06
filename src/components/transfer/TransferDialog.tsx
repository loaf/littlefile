import { useState, useEffect } from 'react';
import { Modal, Button, Select, Space, Typography, message, Tag } from 'antd';
import { SwapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

const { Text } = Typography;

interface TagData { id: number; name: string; file_count: number; created_at: string; }

interface TagMapping { source_tag_id: number; source_name: string; action: 'map' | 'create' | 'skip'; target_tag_id?: number; }

interface TransferDialogProps {
  open: boolean;
  fileIds: number[];
  mode: 'move' | 'copy';
  onClose: () => void;
  onComplete: () => void;
}

export default function TransferDialog({ open, fileIds, mode, onClose, onComplete }: TransferDialogProps) {
  const [targetPath, setTargetPath] = useState('');
  const [targetTags, setTargetTags] = useState<TagData[]>([]);
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [step, setStep] = useState<'select' | 'map' | 'executing'>('select');
  const [history, setHistory] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => {
    invoke<{ name: string; path: string }[]>('get_library_history').then(setHistory).catch(() => {});
  }, [open]);

  const handleSelectTarget = async () => {
    // Fetch target tags
    const remoteTags = await invoke<TagData[]>('get_remote_tags', { dbPath: targetPath });
    setTargetTags(remoteTags);
    // Auto-create mappings (map by name)
    const allTags = await invoke<TagData[]>('list_tags');
    const autoMappings: TagMapping[] = allTags.map(st => {
      const match = remoteTags.find(rt => rt.name.toLowerCase() === st.name.toLowerCase());
      return { source_tag_id: st.id, source_name: st.name, action: match ? 'map' : 'create', target_tag_id: match?.id };
    });
    setMappings(autoMappings);
    setStep('map');
  };

  const handleBrowse = async () => {
    const selected = await openDialog({ filters: [{ name: 'Database', extensions: ['db'] }] });
    if (selected) setTargetPath(selected);
  };

  const handleExecute = async () => {
    setStep('executing');
    try {
      const tagMappings = mappings.map(m => ({
        source_tag_id: m.source_tag_id,
        action: m.action,
        target_tag_id: m.target_tag_id || null,
      }));
      const cmd = mode === 'move' ? 'move_files_to_library' : 'copy_files_to_library';
      await invoke(cmd, { opts: { file_ids: fileIds, target_db_path: targetPath, tag_mappings: tagMappings } });
      message.success(mode === 'move' ? '移动成功' : '复制成功');
      onComplete();
      handleClose();
    } catch (e) { message.error(String(e)); setStep('map'); }
  };

  const handleClose = () => { setStep('select'); setTargetPath(''); setMappings([]); onClose(); };

  return (
    <Modal title={mode === 'move' ? '移动到文件库' : '复制到文件库'} open={open} onCancel={handleClose} footer={null} width={560} maskClosable={false}>
      {step === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text>选择目标文件库</Text>
          {history.length > 0 && (
            <Select style={{ width: '100%' }} placeholder="最近打开的文件库" value={targetPath || undefined}
              onChange={setTargetPath}
              options={history.map(h => ({ label: h.name, value: h.path }))} />
          )}
          <Space>
            <Text type="secondary">{targetPath || '未选择'}</Text>
            <Button size="small" onClick={handleBrowse}>浏览...</Button>
          </Space>
          <Button type="primary" icon={<SwapOutlined />} onClick={handleSelectTarget} disabled={!targetPath}>
            下一步：标签映射
          </Button>
        </div>
      )}

      {step === 'map' && (
        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>标签映射</Text>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 12, display: 'block' }}>
            为每个源标签选择目标库中的映射方式
          </Text>
          {mappings.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Tag>{m.source_name}</Tag>
              <Text type="secondary">→</Text>
              <Select size="small" style={{ width: 160 }}
                value={m.action === 'map' && m.target_tag_id ? `map:${m.target_tag_id}` : m.action}
                onChange={(val: string) => {
                  const newMappings = [...mappings];
                  if (val === 'create') { newMappings[i] = { ...m, action: 'create', target_tag_id: undefined }; }
                  else if (val === 'skip') { newMappings[i] = { ...m, action: 'skip', target_tag_id: undefined }; }
                  else { const tid = Number(val.replace('map:', '')); newMappings[i] = { ...m, action: 'map', target_tag_id: tid }; }
                  setMappings(newMappings);
                }}
                options={[
                  ...targetTags.filter(t => t.name.toLowerCase() === m.source_name.toLowerCase()).map(t => ({ label: `映射到: ${t.name}`, value: `map:${t.id}` })),
                  ...targetTags.filter(t => t.name.toLowerCase() !== m.source_name.toLowerCase()).map(t => ({ label: `映射到: ${t.name}`, value: `map:${t.id}` })),
                  { label: '创建新标签', value: 'create' },
                  { label: '跳过', value: 'skip' },
                ]} />
            </div>
          ))}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button onClick={() => setStep('select')}>返回</Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleExecute}>
              执行{mode === 'move' ? '移动' : '复制'}
            </Button>
          </div>
        </div>
      )}

      {step === 'executing' && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Text>正在{mode === 'move' ? '移动' : '复制'}文件...</Text>
        </div>
      )}
    </Modal>
  );
}
