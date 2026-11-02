import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Handshake, Mail, Palette, UsersRound } from 'lucide-react';

import { buttonVariants } from '../components/ui/button-variants';
import { useTranslation } from '../hooks/useTranslation';

const collaborationAreas = [
  { key: 'community', icon: UsersRound, accent: 'text-emerald-600 dark:text-emerald-300' },
  { key: 'technology', icon: Code2, accent: 'text-blue-600 dark:text-blue-300' },
  { key: 'creative', icon: Palette, accent: 'text-purple-600 dark:text-purple-300' },
  { key: 'support', icon: Handshake, accent: 'text-orange-600 dark:text-orange-300' },
];

export default function PartnershipPage() {
  const { t } = useTranslation(['partnership']);
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'carbontrack666@gmail.com';
  const emailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(t('partnership.contact.subject'))}`;
  const steps = t('partnership.process.steps', { returnObjects: true });

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 blur-[100px] dark:from-primary/20 dark:via-primary/10 dark:opacity-20" />

      <section className="relative px-4 py-12 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {t('partnership.hero.eyebrow')}
            </p>
            <h1 className="mt-4 max-w-3xl whitespace-pre-line bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-5xl">
              {t('partnership.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-xl">
              {t('partnership.hero.description')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#start-partnership"
                className={buttonVariants({
                  size: 'lg',
                  className: 'w-full rounded-full shadow-sm transition-all duration-300 hover:scale-105 sm:w-auto',
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
                  className: 'w-full rounded-full bg-white/5 backdrop-blur-md transition-all duration-300 hover:scale-105 sm:w-auto dark:border-white/10',
                })}
              >
                {t('partnership.hero.secondaryAction')}
              </Link>
            </div>
          </div>

          <aside className="rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 dark:from-emerald-500/10 dark:to-blue-500/10 dark:text-emerald-300">
              <Handshake aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              {t('partnership.purpose.eyebrow')}
            </p>
            <h2 className="mt-3 text-xl font-semibold leading-8 text-foreground sm:text-2xl">
              {t('partnership.purpose.title')}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              {t('partnership.purpose.description')}
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-card/70 px-4 py-16 backdrop-blur-sm sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{t('partnership.areas.title')}</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{t('partnership.areas.description')}</p>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {collaborationAreas.map((area) => {
              const Icon = area.icon;
              return (
                <li key={area.key} className="rounded-2xl border border-black/5 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:bg-white/10">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-500/10 dark:to-blue-500/10 ${area.accent}`}>
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-foreground">
                    {t(`partnership.areas.items.${area.key}.title`)}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {t(`partnership.areas.items.${area.key}.description`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="bg-muted/35 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{t('partnership.process.title')}</h2>
          </div>
          <ol className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-3">
            {(Array.isArray(steps) ? steps : []).map((step, index) => (
              <li key={step.title} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="start-partnership" className="relative overflow-hidden px-4 py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/5 dark:to-primary/10" />
        <div className="mx-auto grid max-w-4xl gap-8 rounded-lg border border-black/5 bg-card p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-md sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-3xl">
              {t('partnership.contact.title')}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t('partnership.contact.description')}
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-flex items-center text-sm font-medium text-emerald-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
            >
              {t('partnership.contact.otherQuestions')}
              <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-black/5 bg-background/50 p-5 dark:border-white/10 dark:bg-white/5">
            <a
              href={emailHref}
              className={buttonVariants({
                size: 'lg',
                className: 'w-full rounded-full shadow-sm transition-all duration-300 hover:scale-105',
              })}
            >
              <Mail aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('partnership.contact.emailAction')}
            </a>
            <p className="mt-4 break-all text-sm text-muted-foreground">{supportEmail}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
