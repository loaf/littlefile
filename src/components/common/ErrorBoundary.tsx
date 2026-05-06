import { Component, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Result status="error" title="程序出现错误" subTitle={this.state.error?.message || '未知错误'}
            extra={<Button type="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>重新加载</Button>} />
        </div>
      );
    }
    return this.props.children;
  }
}
