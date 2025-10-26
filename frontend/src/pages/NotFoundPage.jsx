import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useTranslation } from '../hooks/useTranslation';

export default function NotFoundPage() {
  // 使用项目统一的 i18n Hook
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">{t('notFoundPage.code', '404')}</h1>

        <div className="mb-6 flex items-center justify-center">
          <span
            aria-hidden
            className="text-6xl"
            style={{ display: 'inline-block', transform: 'rotate(30deg) scale(1.4)' }}
          >
            {t('notFoundPage.emoji', '🤔')}
          </span>
        </div>

        <p className="text-lg text-gray-700 mb-2">{t('notFoundPage.message')}</p>
        <p className="text-base text-gray-600 mb-6">{t('notFoundPage.submessage')}</p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            {t('notFoundPage.refresh')}
          </button>

          <Link to="/">
            <Button>
              {t('notFoundPage.home')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
