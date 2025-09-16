import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import PropTypes from 'prop-types';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // 可以在此处上报错误日志到后端
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
      return;
    }
    // 默认行为：刷新当前页面
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const { hasError } = this.state;
    const { t } = this.props; // 允许外部传入翻译函数，避免在错误状态下的 hooks 使用

    if (!hasError) return this.props.children;

    const translate = typeof t === 'function' ? t : (k) => k;

    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-xl mx-auto bg-white border rounded-lg shadow-sm p-6 text-center">
          <div className="flex items-center justify-center mb-4 text-red-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">{translate('errors.unexpected')}</h2>
          <p className="text-muted-foreground mb-6">{translate('errors.tryAgain')}</p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={this.handleRetry}>
              {translate('common.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

RouteErrorBoundary.propTypes = {
  t: PropTypes.func,
  onRetry: PropTypes.func,
  children: PropTypes.node,
};
