import { Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button type="text" icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
      onClick={toggleTheme} size="small" title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'} />
  );
}
