import { useState, useEffect } from 'react';
import { Button, Dropdown, Space, Typography, message, Modal } from 'antd';
import { FolderOpenOutlined, HistoryOutlined, CloseOutlined, SettingOutlined, QuestionCircleOutlined, PlusOutlined, ImportOutlined } from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import SettingsPage from '../settings/SettingsPage';
import { invoke } from '@tauri-apps/api/core';
import ShortcutHelp from '../common/ShortcutHelp';

const { Text } = Typography;

interface HistoryEntry { name: string; path: string; last_opened: string; }

interface LibraryToolbarProps {
  libraryName: string;
  hasLibrary: boolean;
  onOpenLibrary: (path: string) => void;
  onCloseLibrary: () => void;
  onImportClick?: () => void;
}

export default function LibraryToolbar({ libraryName, hasLibrary, onOpenLibrary, onCloseLibrary, onImportClick }: LibraryToolbarProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const fetchHistory = async () => {
    try { setHistory(await invoke<HistoryEntry[]>('get_library_history')); }
    catch {}
  };
  useEffect(() => { fetchHistory(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'F1') { e.preventDefault(); setShowShortcuts(prev => !prev); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleOpenFromHistory = async (entry: HistoryEntry) => {
    try {
      await invoke('get_remote_tags', { dbPath: entry.path });
      onOpenLibrary(entry.path);
      fetchHistory();
    } catch {
      message.error('文件库已移动或删除');
      invoke('remove_library_from_history', { path: entry.path }).catch(() => {});
      fetchHistory();
    }
  };

  const handleOpenLibrary = async () => {
    const selected = await open({ filters: [{ name: 'LittleFile DB', extensions: ['db'] }] });
    if (selected) {
      try { await onOpenLibrary(selected as string); }
      catch (e) { message.error('打开失败: ' + String(e)); }
    }
  };

  const handleCreateLibrary = async () => {
    const filePath = await save({
      filters: [{ name: 'LittleFile DB', extensions: ['db'] }],
      defaultPath: 'library.db',
    });
    if (filePath) {
      try { await onOpenLibrary(filePath); }
      catch (e) { message.error('创建失败: ' + String(e)); }
    }
  };

  return (
    <div style={{ padding: '4px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
      <Space>
        <Text strong style={{ fontSize: 14 }}>{libraryName || 'LittleFile'}</Text>
        {libraryName && <Button type="text" size="small" icon={<CloseOutlined />} onClick={onCloseLibrary} title="关闭文件库" />}
      </Space>
      <Space>
        {history.length > 0 && (
          <Dropdown menu={{ items: history.map(e => ({
            key: e.path,
            label: e.name || e.path.split('\\').pop()?.split('/').pop()?.replace('.db', '') || e.path,
            onClick: () => handleOpenFromHistory(e),
          })) }} trigger={['click']}>
            <Button size="small" icon={<HistoryOutlined />}>最近打开</Button>
          </Dropdown>
        )}
        <Button size="small" icon={<PlusOutlined />} onClick={handleCreateLibrary}>新建库</Button>
        <Button size="small" icon={<FolderOpenOutlined />} onClick={handleOpenLibrary}>打开库</Button>
        {hasLibrary && onImportClick && (
          <Button size="small" type="primary" icon={<ImportOutlined />} onClick={onImportClick}>导入文件</Button>
        )}
        <Button size="small" type="text" icon={<QuestionCircleOutlined />} onClick={() => setShowShortcuts(true)} title="快捷键 (F1)" />
        <Button size="small" type="text" icon={<SettingOutlined />} onClick={() => setShowSettings(true)} title="设置" />
      </Space>
      {showSettings && (
        <Modal title="设置" open={showSettings} onCancel={() => setShowSettings(false)} footer={null} width={560}>
          <SettingsPage onClose={() => setShowSettings(false)} />
        </Modal>
      )}
      <ShortcutHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
