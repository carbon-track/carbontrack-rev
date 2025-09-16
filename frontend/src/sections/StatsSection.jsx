import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export default function StatsSection(){
  const { t } = useTranslation();
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">10,000+</div>
            <div className="text-gray-600">{t('home.stats.users')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">50+</div>
            <div className="text-gray-600">{t('home.stats.activities')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">1,000t</div>
            <div className="text-gray-600">{t('home.stats.carbonSaved')}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">200+</div>
            <div className="text-gray-600">{t('home.stats.rewards')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
