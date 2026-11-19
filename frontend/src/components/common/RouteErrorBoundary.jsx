import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import PropTypes from 'prop-types';
import { useTranslation } from '../../hooks/useTranslation';

function RouteErrorFallback({ onRetry }) {
  const { t } = useTranslation(['errors', 'common']);

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-xl mx-auto bg-white border rounded-lg shadow-sm p-6 text-center">
        <div className="flex items-center justify-center mb-4 text-red-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">{t('errors.unexpected', { defaultValue: '发生未知错误' })}</h2>
        <p className="text-muted-foreground mb-6">{t('errors.tryAgain', { defaultValue: '请稍后重试或刷新页面' })}</p>
        <div className="flex justify-center">
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry', { defaultValue: '重试' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

RouteErrorFallback.propTypes = {
  onRetry: PropTypes.func.isRequired,
};

class RouteErrorBoundary extends React.Component {
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
    if (!this.state.hasError) return this.props.children;
    return <RouteErrorFallback onRetry={this.handleRetry} />;
  }
}

RouteErrorBoundary.propTypes = {
  onRetry: PropTypes.func,
  children: PropTypes.node,
};

export default RouteErrorBoundary;
