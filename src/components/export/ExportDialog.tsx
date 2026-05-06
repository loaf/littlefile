import { useState } from 'react';
import {
  Modal,
  Button,
  Select,
  Input,
  Progress,
  Space,
  Typography,
  message,
  Alert,
  Form,
} from 'antd';
import {
  ExportOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useExport } from '../../hooks/useExport';

const { Text } = Typography;

interface ExportDialogProps {
  open: boolean;
  fileIds: number[];
  onClose: () => void;
}

export default function ExportDialog({ open, fileIds, onClose }: ExportDialogProps) {
  const { phase, progress, startExport, cancel } = useExport();
  const [targetDir, setTargetDir] = useState('');
  const [encoding, setEncoding] = useState('utf-8');

  const handleBrowse = async () => {
    const selected = await openDialog({ directory: true });
    if (selected) setTargetDir(selected);
  };

  const handleExport = async () => {
    try {
      await startExport(fileIds, targetDir, encoding);
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleClose = () => {
    cancel();
    setTargetDir('');
    setEncoding('utf-8');
    onClose();
  };

  const renderFooter = () => {
    switch (phase) {
      case 'idle':
        return (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
              disabled={!targetDir}
            >
              开始导出
            </Button>
          </Space>
        );
      case 'exporting':
        return (
          <Button onClick={handleClose}>取消</Button>
        );
      case 'complete':
        return (
          <Button type="primary" onClick={handleClose}>
            关闭
          </Button>
        );
    }
  };

  const renderBody = () => {
    switch (phase) {
      case 'idle':
        return (
          <Form layout="vertical">
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              marginBottom: 16,
            }}>
              <Text>导出 <Text strong>{fileIds.length}</Text> 个文件</Text>
            </div>
            <Form.Item label="目标目录">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={targetDir}
                  readOnly
                  placeholder="选择导出目录"
                  style={{ flex: 1 }}
                />
                <Button icon={<FolderOpenOutlined />} onClick={handleBrowse}>
                  浏览...
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="编码">
              <Select
                value={encoding}
                onChange={setEncoding}
                style={{ width: '100%' }}
                options={[
                  { label: 'UTF-8', value: 'utf-8' },
                  { label: '原始编码', value: 'original' },
                ]}
              />
            </Form.Item>
          </Form>
        );

      case 'exporting':
        return (
          <div>
            <Progress
              percent={
                progress && progress.total > 0
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0
              }
              status="active"
              strokeColor={{ from: '#1677ff', to: '#52c41a' }}
            />
            <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
              <Text>
                {progress
                  ? `${progress.completed} / ${progress.total} 个文件`
                  : '准备中...'}
              </Text>
              {progress?.current_file && (
                <Text type="secondary" ellipsis>
                  正在导出: {progress.current_file}
                </Text>
              )}
              {progress && progress.total > progress.completed && (
                <Text type="secondary">
                  剩余: {progress.total - progress.completed} 个文件
                </Text>
              )}
            </Space>
          </div>
        );

      case 'complete':
        return (
          <div>
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="导出完成"
              description={
                <Text>
                  成功导出 {progress?.completed ?? fileIds.length} 个文件至
                  <br />
                  <Text code>{targetDir}</Text>
                </Text>
              }
            />
          </div>
        );
    }
  };

  return (
    <Modal
      title="导出文件"
      open={open}
      onCancel={handleClose}
      footer={renderFooter()}
      width={480}
      maskClosable={false}
    >
      {renderBody()}
    </Modal>
  );
}
