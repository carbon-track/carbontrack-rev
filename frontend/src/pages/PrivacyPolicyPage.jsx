import React from 'react';
import { Trans } from 'react-i18next';
import { Database, Eye, Globe, Lock, Mail, Server, Shield } from 'lucide-react';

import { LegalPageLayout, LegalSection } from '../components/legal/LegalPageLayout';
import { useTranslation } from '../hooks/useTranslation';

const toItemKey = (prefix, item) => `${prefix}-${String(item).trim()}`;
const toMailtoLink = (email) => `mailto:${String(email || '').trim()}`;

const PrivacyPolicyPage = () => {
  const { t } = useTranslation(['contact', 'legal']);
  const currentDate = new Date().toLocaleDateString();
  const collectionItems = t('legal.privacy.sections.collection.items', { returnObjects: true });
  const usageItems = t('legal.privacy.sections.usage.items', { returnObjects: true });
  const storageItems = t('legal.privacy.sections.storage.items', { returnObjects: true });
  const rightsItems = t('legal.privacy.sections.rights.items', { returnObjects: true });

  return (
    <LegalPageLayout
      title={t('legal.privacy.title')}
      lastUpdated={t('legal.lastUpdated', { date: currentDate })}
      intro={<Trans ns="legal" i18nKey="legal.privacy.intro" components={{ strong: <strong /> }} />}
    >
      <LegalSection title={t('legal.privacy.sections.identity.title')} icon={Globe}>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.identity.content1" components={{ strong: <strong /> }} />
        </p>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.identity.content2" components={{ strong: <strong /> }} />
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.collection.title')} icon={Database}>
        <p><Trans ns="legal" i18nKey="legal.privacy.sections.collection.intro" components={{ strong: <strong /> }} /></p>
        <ul className="list-disc space-y-2 pl-5 marker:text-emerald-600">
          {Array.isArray(collectionItems) && collectionItems.map((item, index) => (
            <li key={toItemKey(`collection-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.usage.title')} icon={Eye}>
        <p><Trans ns="legal" i18nKey="legal.privacy.sections.usage.intro" components={{ strong: <strong /> }} /></p>
        <ul className="list-disc space-y-2 pl-5 marker:text-emerald-600">
          {Array.isArray(usageItems) && usageItems.map((item, index) => (
            <li key={toItemKey(`usage-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.usage.marketing" components={{ strong: <strong /> }} />
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.storage.title')} icon={Server}>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.storage.content1" components={{ strong: <strong /> }} />
        </p>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.storage.content2" components={{ strong: <strong /> }} />
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-emerald-600">
          {Array.isArray(storageItems) && storageItems.map((item, index) => (
            <li key={toItemKey(`storage-${index}`, item)}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.rights.title')} icon={Shield}>
        <p><Trans ns="legal" i18nKey="legal.privacy.sections.rights.intro" components={{ strong: <strong /> }} /></p>
        <ul className="list-disc space-y-2 pl-5 marker:text-emerald-600">
          {Array.isArray(rightsItems) && rightsItems.map((item, index) => (
            <li key={toItemKey(`rights-${index}`, item)}>
              <Trans defaults={item} components={{ strong: <strong /> }} />
            </li>
          ))}
        </ul>
        <p className="border-l-2 border-emerald-500 bg-emerald-50/70 px-5 py-4 text-sm leading-6 dark:bg-emerald-500/10">
          <Trans
            ns="legal"
            i18nKey="legal.privacy.sections.rights.contact"
            values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
            components={{
              a: <a href={toMailtoLink(import.meta.env.VITE_PRIVACY_EMAIL)} className="font-medium text-emerald-600 underline underline-offset-4 dark:text-emerald-300" />,
            }}
          />
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.retention.title')} icon={Lock}>
        <p>{t('legal.privacy.sections.retention.content1')}</p>
        <p>
          <Trans ns="legal" i18nKey="legal.privacy.sections.retention.content2" components={{ strong: <strong /> }} />
        </p>
      </LegalSection>

      <LegalSection title={t('legal.privacy.sections.contact.title')} icon={Mail}>
        <p>{t('legal.privacy.sections.contact.intro')}</p>
        <div>
          <Trans
            ns="legal"
            i18nKey="legal.privacy.sections.contact.details"
            values={{ email: import.meta.env.VITE_PRIVACY_EMAIL }}
            components={{
              strong: <strong />,
              a: <a href={toMailtoLink(import.meta.env.VITE_PRIVACY_EMAIL)} className="font-medium text-emerald-600 underline underline-offset-4 dark:text-emerald-300" />,
              br: <br />,
            }}
          />
        </div>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default PrivacyPolicyPage;
