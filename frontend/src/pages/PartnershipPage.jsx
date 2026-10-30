import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Handshake, Mail, Palette, UsersRound } from 'lucide-react';

import { buttonVariants } from '../components/ui/button-variants';
import { useTranslation } from '../hooks/useTranslation';

const collaborationAreas = [
  { key: 'community', icon: UsersRound },
  { key: 'technology', icon: Code2 },
  { key: 'creative', icon: Palette },
  { key: 'support', icon: Handshake },
];

export default function PartnershipPage() {
  const { t } = useTranslation(['partnership']);
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'carbontrack666@gmail.com';
  const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(t('partnership.contact.subject'))}`;
  const steps = t('partnership.process.steps', { returnObjects: true });

  return (
    <div className="bg-[#f5f5f1] text-[#304735]">
      <section className="border-b border-[#304735]/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[#267b2f]">
              {t('partnership.hero.eyebrow')}
            </p>
            <h1 className="mt-5 whitespace-pre-line font-serif text-[clamp(1.75rem,9vw,3rem)] font-bold leading-[1.08] tracking-tight sm:text-6xl">
              {t('partnership.hero.title')}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#3b585d] sm:text-lg">
              {t('partnership.hero.description')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#start-partnership"
                className={buttonVariants({
                  size: 'lg',
                  className: 'w-full rounded-none bg-[#304735] text-[#eff7e9] hover:bg-[#263b2b] focus-visible:ring-[#267b2f] sm:w-auto',
                })}
              >
                {t('partnership.hero.primaryAction')}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </a>
              <Link
                to="/about-us"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className: 'w-full rounded-none border-[#304735]/30 bg-transparent text-[#304735] hover:bg-[#e7ecdf] hover:text-[#304735] focus-visible:ring-[#267b2f] sm:w-auto',
                })}
              >
                {t('partnership.hero.secondaryAction')}
              </Link>
            </div>
          </div>

          <aside aria-labelledby="partnership-purpose" className="bg-[#304735] px-7 py-10 text-[#eff7e9] sm:px-9 sm:py-12">
            <p className="text-sm font-medium tracking-[0.12em] text-[#d2e4cb]">
              {t('partnership.purpose.eyebrow')}
            </p>
            <h2 id="partnership-purpose" className="mt-5 font-serif text-3xl font-bold leading-tight sm:text-4xl">
              {t('partnership.purpose.title')}
            </h2>
            <p className="mt-6 text-base leading-7 text-[#eff7e9]/90">
              {t('partnership.purpose.description')}
            </p>
          </aside>
        </div>
      </section>

      <section aria-labelledby="partnership-areas" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
        <h2 id="partnership-areas" className="font-serif text-4xl font-bold leading-tight">
          {t('partnership.areas.title')}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#3b585d]">
          {t('partnership.areas.description')}
        </p>
        <ul className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {collaborationAreas.map((area) => {
            const Icon = area.icon;
            return (
              <li key={area.key} className="border-t border-[#304735]/25 pt-7">
                <Icon aria-hidden="true" className="h-7 w-7 text-[#267b2f]" strokeWidth={1.5} />
                <h3 className="mt-5 font-serif text-2xl font-bold">
                  {t(`partnership.areas.items.${area.key}.title`)}
                </h3>
                <p className="mt-3 max-w-lg text-base leading-7 text-[#3b585d]">
                  {t(`partnership.areas.items.${area.key}.description`)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="partnership-process" className="border-y border-[#304735]/20 bg-[#e9ede3]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <h2 id="partnership-process" className="font-serif text-4xl font-bold leading-tight">
            {t('partnership.process.title')}
          </h2>
          <ol className="mt-10 grid gap-9 md:grid-cols-3 md:gap-10">
            {(Array.isArray(steps) ? steps : []).map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true" className="font-serif text-3xl text-[#267b2f]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#3b585d]">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="start-partnership" aria-labelledby="partnership-contact" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-6 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16 lg:py-20">
        <div>
          <h2 id="partnership-contact" className="font-serif text-4xl font-bold leading-tight">
            {t('partnership.contact.title')}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#3b585d]">
            {t('partnership.contact.description')}
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-block text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#267b2f]"
          >
            {t('partnership.contact.otherQuestions')}
          </Link>
        </div>
        <div className="min-w-0 border-l-2 border-[#267b2f] pl-6">
          <a
            href={emailHref}
            className={buttonVariants({
              size: 'lg',
              className: 'rounded-none bg-[#304735] text-[#eff7e9] hover:bg-[#263b2b] focus-visible:ring-[#267b2f]',
            })}
          >
            <Mail aria-hidden="true" className="mr-2 h-4 w-4" />
            {t('partnership.contact.emailAction')}
          </a>
          <p className="mt-4 break-all text-sm text-[#3b585d]">{supportEmail}</p>
        </div>
      </section>
    </div>
  );
}
