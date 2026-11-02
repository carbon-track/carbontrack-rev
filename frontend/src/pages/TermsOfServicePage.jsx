import React from 'react';
import { Trans } from 'react-i18next';
import { AlertTriangle, FileText, Gavel, Scale, ShieldAlert, UserCheck } from 'lucide-react';

import { LegalPageLayout, LegalSection } from '../components/legal/LegalPageLayout';
import { useTranslation } from '../hooks/useTranslation';

const TermsOfServicePage = () => {
  const { t } = useTranslation(['contact', 'legal']);
  const currentDate = new Date().toLocaleDateString();
  const responsibilityItems = t('legal.terms.sections.responsibility.items', { returnObjects: true });

  return (
    <LegalPageLayout
      title={t('legal.terms.title')}
      lastUpdated={t('legal.lastUpdated', { date: currentDate })}
      intro={t('legal.terms.intro')}
    >
      <LegalSection title={t('legal.terms.sections.agreement.title')} icon={FileText}>
        <p>
          <Trans ns="legal" i18nKey="legal.terms.sections.agreement.content1" components={{ strong: <strong /> }} />
        </p>
        <p>
          <Trans ns="legal" i18nKey="legal.terms.sections.agreement.content2" components={{ strong: <strong /> }} />
        </p>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.responsibility.title')} icon={UserCheck}>
        <p>{t('legal.terms.sections.responsibility.intro')}</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#267b2f]">
          {Array.isArray(responsibilityItems) && responsibilityItems.map((item, index) => (
            <li key={index}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.ip.title')} icon={Scale}>
        <p>{t('legal.terms.sections.ip.content')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.liability.title')} icon={AlertTriangle}>
        <p>{t('legal.terms.sections.liability.content')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.law.title')} icon={Gavel}>
        <p>
          <Trans ns="legal" i18nKey="legal.terms.sections.law.content1" components={{ strong: <strong /> }} />
        </p>
        <p>{t('legal.terms.sections.law.content2')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.changes.title')} icon={ShieldAlert}>
        <p>{t('legal.terms.sections.changes.content')}</p>
      </LegalSection>

      <LegalSection title={t('legal.terms.sections.contact.title')} icon={FileText}>
        <p>
          <Trans
            ns="legal"
            i18nKey="legal.terms.sections.contact.content"
            values={{ email: import.meta.env.VITE_LEGAL_EMAIL }}
            components={{
              a: <a className="font-medium text-[#267b2f] underline underline-offset-4" />,
            }}
          />
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default TermsOfServicePage;
