import { Modal, Table, Typography } from 'antd';

const { Text } = Typography;

interface ShortcutHelpProps { open: boolean; onClose: () => void; }

const SHORTCUTS = [
  { key: '1', scope: '文本阅读', shortcut: '← / →', description: '上一页 / 下一页' },
  { key: '2', scope: '文本阅读', shortcut: 'Page Up / Down', description: '上一章 / 下一章' },
  { key: '3', scope: '文本阅读', shortcut: 'Space', description: '向下滚动一屏' },
  { key: '4', scope: '文本阅读', shortcut: 'Ctrl+F', description: '打开文内搜索栏' },
  { key: '5', scope: '文本阅读', shortcut: 'Enter (搜索栏)', description: '下一个匹配' },
  { key: '6', scope: '文本阅读', shortcut: 'Shift+Enter', description: '上一个匹配' },
  { key: '7', scope: '文本阅读', shortcut: 'Escape (搜索栏)', description: '关闭搜索栏、清除高亮' },
  { key: '8', scope: '文本阅读', shortcut: 'Ctrl++ / Ctrl+-', description: '放大/缩小字体' },
  { key: '9', scope: '文本阅读', shortcut: 'Ctrl+0', description: '重置字体大小' },
  { key: '10', scope: '文本阅读', shortcut: 'Ctrl+C', description: '复制选中文本' },
  { key: '11', scope: '全局', shortcut: 'Ctrl+A', description: '全选（文件列表）' },
  { key: '12', scope: '全局', shortcut: 'Ctrl+Shift+O', description: '用外部程序打开' },
  { key: '13', scope: '全局', shortcut: 'Delete', description: '删除选中文件' },
  { key: '14', scope: '全局', shortcut: 'Escape', description: '关闭阅读/取消操作' },
  { key: '15', scope: '全局', shortcut: 'F1', description: '显示快捷键帮助' },
];

export default function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  return (
    <Modal title="快捷键帮助" open={open} onCancel={onClose} footer={null} width={560}>
      <Table dataSource={SHORTCUTS} pagination={false} size="small" rowKey="key"
        columns={[
          { title: '作用域', dataIndex: 'scope', width: 100, render: (v: string) => <Text type="secondary">{v}</Text> },
          { title: '快捷键', dataIndex: 'shortcut', render: (v: string) => <Text code>{v}</Text> },
          { title: '功能', dataIndex: 'description' },
        ]} />
    </Modal>
  );
}
