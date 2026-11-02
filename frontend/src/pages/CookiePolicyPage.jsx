import React from 'react';
import { Trans } from 'react-i18next';
import { Cookie, Eye, Info, Settings } from 'lucide-react';

import { LegalPageLayout, LegalSection } from '../components/legal/LegalPageLayout';
import { useTranslation } from '../hooks/useTranslation';

const toItemKey = (prefix, item) => `${prefix}-${String(item).trim()}`;

const CookiePolicyPage = () => {
  const { t } = useTranslation(['legal']);
  const currentDate = new Date().toLocaleDateString();
  const thirdPartyItems = t('legal.cookies.sections.thirdParty.items', { returnObjects: true });

  return (
    <LegalPageLayout
      title={t('legal.cookies.title')}
      lastUpdated={t('legal.lastUpdated', { date: currentDate })}
      intro={t('legal.cookies.intro')}
    >
      <LegalSection title={t('legal.cookies.sections.what.title')} icon={Info}>
        <p>{t('legal.cookies.sections.what.content')}</p>
      </LegalSection>

      <LegalSection title={t('legal.cookies.sections.how.title')} icon={Cookie}>
        <p>{t('legal.cookies.sections.how.intro')}</p>
        <div className="space-y-4 border-l-2 border-[#267b2f] pl-5">
          <div className="border-t border-[#304735]/15 pt-4 first:border-t-0 first:pt-0">
            <h3 className="font-serif text-xl font-bold text-[#304735]">
              {t('legal.cookies.sections.how.types.essential.title')}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {t('legal.cookies.sections.how.types.essential.desc')}
            </p>
          </div>
          <div className="border-t border-[#304735]/15 pt-4">
            <h3 className="font-serif text-xl font-bold text-[#304735]">
              {t('legal.cookies.sections.how.types.performance.title')}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {t('legal.cookies.sections.how.types.performance.desc')}
            </p>
          </div>
          <div className="border-t border-[#304735]/15 pt-4">
            <h3 className="font-serif text-xl font-bold text-[#304735]">
              {t('legal.cookies.sections.how.types.functionality.title')}
            </h3>
            <p className="mt-2 text-sm leading-6">
              {t('legal.cookies.sections.how.types.functionality.desc')}
            </p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title={t('legal.cookies.sections.thirdParty.title')} icon={Eye}>
        <p>{t('legal.cookies.sections.thirdParty.intro')}</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#267b2f]">
          {Array.isArray(thirdPartyItems) && thirdPartyItems.map((item, index) => (
            <li key={toItemKey(`third-party-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.cookies.sections.managing.title')} icon={Settings}>
        <p>{t('legal.cookies.sections.managing.content1')}</p>
        <p>{t('legal.cookies.sections.managing.content2')}</p>
      </LegalSection>

      <LegalSection title={t('legal.cookies.sections.updates.title')} icon={Info}>
        <p>{t('legal.cookies.sections.updates.content')}</p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default CookiePolicyPage;
