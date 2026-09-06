import React, { useMemo } from 'react';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const PORTRAIT_PLACEHOLDERS = [
  'from-[#d7decf] via-[#a9b9a1] to-[#687d69]',
  'from-[#e0d9cb] via-[#b6aa95] to-[#6f7563]',
  'from-[#d4dfe0] via-[#9aafb0] to-[#526d6f]',
  'from-[#d9d1c6] via-[#ada28f] to-[#65735d]',
  'from-[#d2dbcb] via-[#91aa8b] to-[#4b6751]',
  'from-[#ddd7d0] via-[#aaa8a0] to-[#626b68]',
];

const getMemberInitials = (name = '') => {
  const nickname = name.match(/\(([^)]+)\)/)?.[1]?.trim();
  const words = name.replace(/\([^)]+\)/g, '').trim().split(/\s+/).filter(Boolean);
  const firstInitial = nickname?.charAt(0) || words[0]?.charAt(0) || '';
  const lastInitial = words.length > 1 ? words.at(-1).charAt(0) : '';

  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const TeamMemberCard = React.memo(({ member, index, photoPlaceholderLabel }) => {
  const nameContent = (
    <>
      <span>{member.name}</span>
      {member.link ? (
        <ArrowUpRight
          aria-hidden="true"
          className="h-[0.8em] w-[0.8em] shrink-0 transition-transform duration-300 group-hover/name:-translate-y-0.5 group-hover/name:translate-x-0.5"
        />
      ) : null}
    </>
  );

  return (
    <article className="flex h-full min-w-0 flex-col bg-[#304735] p-3 text-[#eff7e9] shadow-[0_18px_45px_rgba(35,58,41,0.12)] transition-transform duration-300 hover:-translate-y-1">
      <div
        role="img"
        aria-label={photoPlaceholderLabel}
        className={`relative flex aspect-[215/229] items-center justify-center overflow-hidden bg-gradient-to-br ${PORTRAIT_PLACEHOLDERS[index % PORTRAIT_PLACEHOLDERS.length]}`}
      >
        <div className="absolute -left-10 top-5 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-14 right-0 h-40 w-40 rounded-full bg-[#1f3928]/35 blur-2xl" />
        <UserRound aria-hidden="true" className="relative h-20 w-20 text-[#f0f5e8]/55" strokeWidth={1.1} />
        <span className="absolute bottom-4 right-4 font-serif text-xl font-bold tracking-[0.12em] text-white/80">
          {getMemberInitials(member.name)}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-2 pt-4 font-serif">
        <h2 className="text-[1.55rem] font-bold leading-none tracking-[0.01em] text-[#e7f9df]">
          {member.link ? (
            <a
              href={member.link}
              target="_blank"
              rel="noreferrer"
              className="group/name inline-flex items-start gap-1 underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7f9df]/70"
            >
              {nameContent}
            </a>
          ) : (
            <span className="underline decoration-1 underline-offset-2">{nameContent}</span>
          )}
        </h2>

        {member.role ? (
          <p className="mt-2 text-sm font-bold leading-[1.15] text-white">
            {member.role}
          </p>
        ) : null}

        <p className="mt-5 text-[0.82rem] font-semibold leading-[1.35] text-white/90">
          {member.bio}
        </p>
      </div>
    </article>
  );
});

TeamMemberCard.displayName = 'TeamMemberCard';

const AboutUsPage = () => {
  const { t } = useTranslation(['about']);
  const hero = t('about.hero', { returnObjects: true }) || {};
  const contactLinks = t('about.contactLinks', {
    returnObjects: true,
    email: import.meta.env.VITE_SUPPORT_EMAIL,
  }) || [];
  const team = t('about.team', { returnObjects: true }) || {};

  const members = useMemo(
    () => (Array.isArray(team?.members) ? team.members : []),
    [team?.members]
  );

  return (
    <div className="bg-[#f5f5f1] text-[#3b585d]">
      <header className="relative isolate flex min-h-[calc(100svh-4rem)] items-start justify-center overflow-hidden px-6 py-20 sm:items-center sm:py-24">
        <img
          src="/images/about/people-hero.png"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[#102d2b]/25" />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center font-serif text-[#e0ffe5]">
          <h1 className="text-6xl font-bold leading-none tracking-[0.015em] drop-shadow-[0_3px_20px_rgba(0,0,0,0.3)] sm:text-7xl lg:text-8xl">
            {hero.displayTitle || hero.title || 'People'}
          </h1>
          {hero.subtitle ? (
            <p className="mt-28 max-w-2xl text-xl font-bold leading-[1.15] tracking-[0.02em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] sm:mt-32 sm:text-2xl">
              {hero.subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1280px] lg:grid-cols-[35.5%_64.5%]">
        <aside className="border-b border-[#2f7b3a]/70 px-6 py-14 sm:px-8 lg:border-b-0 lg:border-r lg:px-9 lg:py-12">
          <div className="lg:sticky lg:top-28">
            <h2 className="max-w-sm whitespace-pre-line font-serif text-5xl font-bold leading-[1.02] tracking-[0.01em] text-[#267b2f] sm:text-6xl lg:text-[3.25rem]">
              {team.displayTitle || team.title || 'Our Team'}
            </h2>

            <nav aria-label={team.contactNavigationLabel || team.title} className="mt-14 sm:mt-16">
              <ul className="flex flex-wrap gap-x-7 gap-y-4 lg:flex-col lg:items-start lg:gap-3">
                {contactLinks.map((item) => (
                  <li key={`${item.type}-${item.href}`}>
                    <a
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                      className="font-serif text-xl font-bold text-[#3b585d] underline decoration-1 underline-offset-2 transition-colors hover:text-[#267b2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#267b2f]/40"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <section className="min-w-0 px-6 py-12 sm:px-10 lg:px-[5.5rem] lg:py-10">
          {team.intro ? (
            <p className="max-w-3xl font-serif text-[1.75rem] font-bold leading-[1.08] tracking-[0.015em] text-[#3b585d] sm:text-4xl sm:leading-[1.02] lg:text-[2.35rem]">
              {team.intro}
            </p>
          ) : null}

          <div className="mt-20 grid items-stretch gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-9 xl:gap-y-16">
            {members.map((member, index) => (
              <TeamMemberCard
                key={member.name}
                member={member}
                index={index}
                photoPlaceholderLabel={t('about.team.photoPlaceholder', { name: member.name })}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutUsPage;
