import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AtSign, Building2, MapPin, Phone } from 'lucide-react';

import { buttonVariants } from '../components/ui/button-variants';
import { useTranslation } from '../hooks/useTranslation';

const supportEmail = import.meta.env?.VITE_SUPPORT_EMAIL || 'support@carbontrack.org';
const supportPhone = '+1 475-280-7571';

export default function ContactPage() {
  const { t } = useTranslation(['contact', 'footer']);

  const contactLinks = useMemo(() => {
    const translated = t('contact.links', {
      returnObjects: true,
      email: supportEmail,
    });
    return Array.isArray(translated) ? translated : [];
  }, [t]);

  const contactCards = [
    {
      icon: AtSign,
      eyebrow: t('contact.methods.emailTitle'),
      title: supportEmail,
      description: t('contact.methods.emailDescription'),
      href: `mailto:${supportEmail}`,
    },
    {
      icon: Phone,
      eyebrow: t('contact.methods.phoneTitle'),
      title: supportPhone,
      description: t('contact.methods.phoneDescription'),
      href: `tel:${supportPhone.replaceAll(' ', '')}`,
    },
    {
      icon: MapPin,
      eyebrow: t('contact.methods.addressTitle'),
      title: t('footer.address'),
      description: t('contact.methods.addressDescription'),
      href: null,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 blur-[100px] dark:from-primary/20 dark:via-primary/10 dark:opacity-20" />

      <section className="relative px-4 py-12 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {t('contact.hero.eyebrow')}
            </p>
            <h1 className="mt-4 max-w-3xl bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-5xl">
              {t('contact.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-xl">
              {t('contact.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`mailto:${supportEmail}`}
                className={buttonVariants({
                  size: 'lg',
                  className: 'w-full rounded-full shadow-sm transition-all duration-300 hover:scale-105 sm:w-auto',
                })}
              >
                <AtSign aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('contact.hero.primaryAction')}
              </a>
              <Link
                to="/help"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className: 'w-full rounded-full bg-white/5 backdrop-blur-md transition-all duration-300 hover:scale-105 sm:w-auto dark:border-white/10',
                })}
              >
                {t('contact.hero.secondaryAction')}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <aside aria-labelledby="contact-panel-title" className="rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 p-6 shadow-sm sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 dark:from-emerald-500/10 dark:to-blue-500/10 dark:text-emerald-300">
              <Building2 aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              {t('contact.panel.title')}
            </p>
            <p id="contact-panel-title" className="mt-3 text-xl font-semibold leading-8 text-foreground sm:text-2xl">
              {t('contact.panel.body')}
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-card/70 px-4 py-12 backdrop-blur-sm sm:py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold text-foreground">{t('contact.hero.eyebrow')}</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {contactCards.map((card) => {
              const Icon = card.icon;
              const content = (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 dark:from-emerald-500/10 dark:to-blue-500/10 dark:text-emerald-300">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{card.eyebrow}</p>
                  <p className="mt-3 break-words text-lg font-semibold text-foreground">{card.title}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.description}</p>
                  {card.href ? <ArrowRight aria-hidden="true" className="mt-5 h-5 w-5 text-emerald-600 transition-transform group-hover:translate-x-1 dark:text-emerald-300" /> : null}
                </>
              );

              return card.href ? (
                <li key={card.eyebrow} className="group rounded-2xl border border-black/5 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:bg-white/10">
                  <a href={card.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                    {content}
                  </a>
                </li>
              ) : (
                <li key={card.eyebrow} className="rounded-2xl border border-black/5 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">{content}</li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/5 dark:to-primary/10" />
        <div className="mx-auto max-w-4xl rounded-lg border border-black/5 bg-card p-6 text-center shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-md sm:p-12">
          <h2 className="mb-4 bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-3xl">
            {t('contact.linksTitle')}
          </h2>
          <ul className="mx-auto grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            {contactLinks.map((link, index) => (
              <li key={`${link.type}-${index}`}>
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-background/50 px-4 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-white/10 dark:bg-white/5"
                >
                  <span>{link.label}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
