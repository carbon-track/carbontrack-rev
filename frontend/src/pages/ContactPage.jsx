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
    <div className="bg-[#f5f5f1] text-[#304735]">
      <section className="border-b border-[#304735]/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[#267b2f]">
              {t('contact.hero.eyebrow')}
            </p>
            <h1 className="mt-5 max-w-3xl font-serif text-[clamp(1.75rem,9vw,3rem)] font-bold leading-[1.08] tracking-tight sm:text-6xl">
              {t('contact.hero.title')}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#3b585d] sm:text-lg">
              {t('contact.hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={`mailto:${supportEmail}`}
                className={buttonVariants({
                  size: 'lg',
                  className: 'w-full rounded-none bg-[#304735] text-[#eff7e9] hover:bg-[#263b2b] focus-visible:ring-[#267b2f] sm:w-auto',
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
                  className: 'w-full rounded-none border-[#304735]/30 bg-transparent text-[#304735] hover:bg-[#e7ecdf] hover:text-[#304735] focus-visible:ring-[#267b2f] sm:w-auto',
                })}
              >
                {t('contact.hero.secondaryAction')}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <aside aria-labelledby="contact-panel-title" className="bg-[#304735] px-7 py-10 text-[#eff7e9] sm:px-9 sm:py-12">
            <div className="flex items-center gap-3 text-[#d2e4cb]">
              <Building2 aria-hidden="true" className="h-5 w-5" />
              <span className="text-sm font-medium tracking-[0.12em]">{t('contact.panel.title')}</span>
            </div>
            <p id="contact-panel-title" className="mt-5 font-serif text-3xl font-bold leading-tight sm:text-4xl">
              {t('contact.panel.body')}
            </p>
          </aside>
        </div>
      </section>

      <section aria-labelledby="contact-methods" className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
        <h2 id="contact-methods" className="font-serif text-4xl font-bold leading-tight">
          {t('contact.hero.eyebrow')}
        </h2>
        <ul className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-3">
          {contactCards.map((card) => {
            const Icon = card.icon;
            const content = (
              <>
                <Icon aria-hidden="true" className="h-7 w-7 text-[#267b2f]" strokeWidth={1.5} />
                <p className="mt-5 text-sm font-semibold tracking-[0.1em] text-[#267b2f]">{card.eyebrow}</p>
                <p className="mt-3 break-words font-serif text-2xl font-bold text-[#304735]">{card.title}</p>
                <p className="mt-3 text-base leading-7 text-[#3b585d]">{card.description}</p>
                {card.href ? <ArrowRight aria-hidden="true" className="mt-5 h-5 w-5 text-[#267b2f]" /> : null}
              </>
            );

            return card.href ? (
              <li key={card.eyebrow} className="border-t border-[#304735]/25 pt-7">
                <a href={card.href} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#267b2f]">
                  {content}
                </a>
              </li>
            ) : (
              <li key={card.eyebrow} className="border-t border-[#304735]/25 pt-7">{content}</li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="contact-links" className="border-y border-[#304735]/20 bg-[#e9ede3]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
          <h2 id="contact-links" className="font-serif text-4xl font-bold leading-tight">
            {t('contact.linksTitle')}
          </h2>
          <ul className="mt-8 grid gap-x-12 gap-y-5 md:grid-cols-2">
            {contactLinks.map((link, index) => (
              <li key={`${link.type}-${index}`} className="border-t border-[#304735]/25 pt-4">
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-between gap-3 text-base font-semibold text-[#304735] underline decoration-1 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#267b2f]"
                >
                  <span>{link.label}</span>
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#267b2f]" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
