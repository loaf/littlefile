import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  InputNumber,
  Switch,
  Progress,
  Collapse,
  Alert,
  Space,
  Typography,
  Spin,
  Tag,
  Form,
  Divider,
  Badge,
} from 'antd';
import {
  FolderOpenOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ScanOutlined,
  ImportOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useImport } from '../../hooks/useImport';
import type { ImportErrorItem } from '../../hooks/useImport';

const { Text } = Typography;

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}分${secs}秒`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}时${mins}分`;
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ImportDialog({ open, onClose, onComplete }: ImportDialogProps) {
  const {
    phase,
    scanResult,
    progress,
    errors,
    summary,
    scan,
    start,
    pause,
    resume,
    cancel,
    reset,
  } = useImport();

  const [path, setPath] = useState('');
  const [dedupStrategy, setDedupStrategy] = useState('skip');
  const [batchSize, setBatchSize] = useState(500);
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (phase === 'complete' && onComplete) onComplete();
  }, [phase, onComplete]);

  const handleBrowse = async () => {
    const selected = await openDialog({ directory: true });
    if (selected) {
      setPath(selected);
      setErrorMsg('');
    }
  };

  const handleScan = async () => {
    if (!path.trim()) return;
    setErrorMsg('');
    setScanning(true);
    try {
      await scan(path);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleStartImport = async () => {
    setErrorMsg('');
    try {
      await start(path, {
        batch_size: batchSize,
        dedup_strategy: dedupStrategy,
        delete_after_import: deleteAfterImport,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePause = async () => {
    try {
      await pause();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResume = async () => {
    try {
      await resume();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCancel = async () => {
    try {
      await cancel();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleClose = async () => {
    if (phase === 'importing' || phase === 'paused') {
      await handleCancel();
    }
    await reset();
    setPath('');
    setDedupStrategy('skip');
    setBatchSize(500);
    setDeleteAfterImport(false);
    setErrorMsg('');
    setScanning(false);
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
              icon={<ScanOutlined />}
              onClick={handleScan}
              disabled={!path.trim()}
              loading={scanning}
            >
              扫描文件
            </Button>
          </Space>
        );
      case 'scanning':
        return <Button onClick={handleClose}>取消</Button>;
      case 'ready':
        return (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={handleStartImport}
            >
              开始导入
            </Button>
          </Space>
        );
      case 'importing':
        return (
          <Space>
            <Button
              icon={<PauseCircleOutlined />}
              onClick={handlePause}
            >
              暂停
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleCancel}
            >
              取消导入
            </Button>
          </Space>
        );
      case 'paused':
        return (
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleResume}
            >
              继续
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleCancel}
            >
              取消导入
            </Button>
          </Space>
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
            <Form.Item label="源路径">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={path}
                  onChange={(e) => {
                    setPath(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="选择包含 .txt 文件的文件夹"
                  onPressEnter={path.trim() ? handleScan : undefined}
                />
                <Button icon={<FolderOpenOutlined />} onClick={handleBrowse}>
                  浏览...
                </Button>
              </Space.Compact>
            </Form.Item>
          </Form>
        );

      case 'scanning':
        return (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin tip="正在扫描文件夹..." size="large">
              <div />
            </Spin>
          </div>
        );

      case 'ready':
        return (
          <div>
            <Alert
              type="info"
              showIcon
              message={
                <Space size="large">
                  <Text>{scanResult?.file_count} 个 .txt 文件</Text>
                  <Divider type="vertical" />
                  <Text>{scanResult ? formatBytes(scanResult.total_size) : ''}</Text>
                  <Divider type="vertical" />
                  <Text>{path}</Text>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />

            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: (
                    <Space>
                      <SettingOutlined />
                      <Text>高级选项</Text>
                    </Space>
                  ),
                  children: (
                    <Form layout="vertical" size="small">
                      <Form.Item label="去重策略">
                        <Select
                          value={dedupStrategy}
                          onChange={setDedupStrategy}
                          options={[
                            { label: '跳过重复文件', value: 'skip' },
                            { label: '覆盖已有文件', value: 'overwrite' },
                            { label: '遇到重复时报错', value: 'error' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="批量大小">
                        <InputNumber
                          value={batchSize}
                          onChange={(val) => setBatchSize(val ?? 500)}
                          min={100}
                          max={2000}
                          step={100}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item label="导入后删除源文件">
                        <Switch
                          checked={deleteAfterImport}
                          onChange={setDeleteAfterImport}
                        />
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />
          </div>
        );

      case 'importing':
      case 'paused':
        return (
          <div>
            <Progress
              percent={
                progress && progress.total > 0
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0
              }
              status={phase === 'paused' ? 'normal' : 'active'}
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
                  正在处理: {progress.current_file}
                </Text>
              )}
              {progress && progress.estimated_remaining_secs > 0 && (
                <Text type="secondary">
                  剩余时间: ~{formatTime(progress.estimated_remaining_secs)}
                </Text>
              )}
            </Space>
            {errors.length > 0 && (
              <Tag color="warning" icon={<WarningOutlined />} style={{ marginTop: 12 }}>
                {errors.length} 个错误
              </Tag>
            )}
            {phase === 'paused' && (
              <Alert
                type="warning"
                message="导入已暂停"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </div>
        );

      case 'complete':
        return (
          <div>
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="导入完成"
              description={
                <Space size="large">
                  <Text>成功 {summary?.imported ?? 0} 个</Text>
                  <Divider type="vertical" />
                  <Text>跳过 {summary?.skipped ?? 0} 个</Text>
                  <Divider type="vertical" />
                  <Badge
                    count={summary?.errors.length ?? 0}
                    offset={[6, 0]}
                    size="small"
                  >
                    <Text type={summary && summary.errors.length > 0 ? 'danger' : undefined}>
                      失败 {summary?.errors.length ?? 0} 个
                    </Text>
                  </Badge>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
            {summary && summary.errors.length > 0 && (
              <Collapse
                ghost
                items={[
                  {
                    key: 'errors',
                    label: (
                      <Space>
                        <WarningOutlined style={{ color: '#fa8c16' }} />
                        <Text type="danger">错误详情 ({summary.errors.length})</Text>
                      </Space>
                    ),
                    children: (
                      <div>
                        {summary.errors.map((err: ImportErrorItem, idx: number) => (
                          <div key={idx} style={{ marginBottom: 4 }}>
                            <Text type="secondary">{err.file}</Text>
                            <Text type="danger"> — {err.error}</Text>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </div>
        );
    }
  };

  return (
    <Modal
      title="导入文件"
      open={open}
      onCancel={handleClose}
      footer={renderFooter()}
      width={560}
      maskClosable={false}
      closable={phase !== 'importing' && phase !== 'paused'}
    >
      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          closable
          onClose={() => setErrorMsg('')}
          style={{ marginBottom: 16 }}
        />
      )}
      {renderBody()}
    </Modal>
  );
}
