import React from 'react';
import { Trans } from 'react-i18next';
import { AlertCircle, Bug, Lock, Server, ShieldCheck } from 'lucide-react';

import { LegalPageLayout, LegalSection } from '../components/legal/LegalPageLayout';
import { useTranslation } from '../hooks/useTranslation';

const toItemKey = (prefix, item) => `${prefix}-${String(item).trim()}`;
const toMailtoLink = (email) => `mailto:${String(email || '').trim()}`;

const SecurityPage = () => {
  const { t } = useTranslation(['app', 'legal']);
  const infraItems = t('legal.security.sections.infrastructure.items', { returnObjects: true });
  const appItems = t('legal.security.sections.app.items', { returnObjects: true });
  const vulnItems = t('legal.security.sections.vuln.items', { returnObjects: true });

  return (
    <LegalPageLayout
      title={t('legal.security.title')}
      intro={t('legal.security.subtitle')}
    >
      <LegalSection title={t('legal.security.sections.commitment.title')} icon={ShieldCheck}>
        <p>{t('legal.security.sections.commitment.content')}</p>
      </LegalSection>

      <LegalSection title={t('legal.security.sections.infrastructure.title')} icon={Server}>
        <p>{t('legal.security.sections.infrastructure.intro')}</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#267b2f]">
          {Array.isArray(infraItems) && infraItems.map((item, index) => (
            <li key={toItemKey(`infra-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.security.sections.app.title')} icon={Lock}>
        <ul className="list-disc space-y-2 pl-5 marker:text-[#267b2f]">
          {Array.isArray(appItems) && appItems.map((item, index) => (
            <li key={toItemKey(`app-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.security.sections.vuln.title')} icon={Bug}>
        <p>{t('legal.security.sections.vuln.intro')}</p>
        <div className="mt-6 border-l-2 border-[#267b2f] bg-[#e9ede3] px-5 py-4">
          <h3 className="font-serif text-xl font-bold text-[#304735]">
            {t('legal.security.sections.vuln.policyTitle')}
          </h3>
          <p className="mt-2 text-sm leading-6">
            <Trans
              ns="legal"
              i18nKey="legal.security.sections.vuln.contact"
              values={{ email: import.meta.env.VITE_SECURITY_EMAIL }}
              components={{
                a: <a href={toMailtoLink(import.meta.env.VITE_SECURITY_EMAIL)} className="font-medium text-[#267b2f] underline underline-offset-4" />,
              }}
            />
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 marker:text-[#267b2f]">
            {Array.isArray(vulnItems) && vulnItems.map((item, index) => (
              <li key={toItemKey(`vuln-${index}`, item)}>{item}</li>
            ))}
          </ul>
        </div>
      </LegalSection>

      <LegalSection title={t('legal.security.sections.breach.title')} icon={AlertCircle}>
        <p>
          <Trans ns="legal" i18nKey="legal.security.sections.breach.content" components={{ strong: <strong /> }} />
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default SecurityPage;
