import { useState } from 'react';
import { Button, Descriptions, Space, Typography, Input, message } from 'antd';
import { LeftOutlined, RightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import TagInput from '../tags/TagInput';

const { Text } = Typography;

interface MetaPanelProps {
  filename: string;
  author: string;
  encoding: string;
  fileId: number;
  description: string;
  tagIds: string;
  onDescriptionChanged?: () => void;
  onTagsChanged?: () => void;
}

export default function MetaPanel({
  filename, author, encoding, fileId, description, tagIds,
  onDescriptionChanged, onTagsChanged,
}: MetaPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(description);
  const [savingDesc, setSavingDesc] = useState(false);

  const parsedTagIds = tagIds
    ? tagIds.split(',').map(Number).filter(n => !isNaN(n))
    : [];

  const handleSaveDescription = async () => {
    if (descValue === description) {
      setEditingDesc(false);
      return;
    }
    setSavingDesc(true);
    try {
      await invoke('update_description', {
        id: fileId,
        description: descValue.slice(0, 500),
      });
      setEditingDesc(false);
      onDescriptionChanged?.();
    } catch (e) {
      message.error(String(e));
    } finally {
      setSavingDesc(false);
    }
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          height: '100%',
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 12,
          flexShrink: 0,
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<LeftOutlined />}
          onClick={() => setCollapsed(false)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <Space size={4}>
          <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
          <Text strong style={{ fontSize: 13 }}>文件信息</Text>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<RightOutlined />}
          onClick={() => setCollapsed(true)}
        />
      </div>

      <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="文件名">
            <Text ellipsis style={{ maxWidth: 120 }}>{filename}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="作者">
            {author || <Text type="secondary">-</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="编码">
            {encoding}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>描述</Text>
          {editingDesc ? (
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              value={descValue}
              onChange={e => setDescValue(e.target.value)}
              onBlur={handleSaveDescription}
              onPressEnter={e => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSaveDescription();
                }
              }}
              disabled={savingDesc}
              maxLength={500}
              autoFocus
            />
          ) : (
            <Text
              type={description ? 'secondary' : 'secondary'}
              style={{ fontSize: 12, cursor: 'pointer', display: 'block' }}
              onClick={() => {
                setDescValue(description);
                setEditingDesc(true);
              }}
            >
              {description || '点击添加描述...'}
            </Text>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>标签</Text>
          <TagInput
            fileIds={[fileId]}
            initialTagIds={parsedTagIds}
            onTagsChanged={onTagsChanged}
          />
        </div>
      </div>
    </div>
  );
}
