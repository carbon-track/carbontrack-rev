import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">404</h1>
        <p className="text-xl text-gray-600 mb-8">{t('errors.notFound')}</p>
        <Link to="/">
          <Button>
            {t('common.back')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
