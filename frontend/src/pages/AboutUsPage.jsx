import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Search, SearchX, UserRound, X } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useTranslation } from '../hooks/useTranslation';
import { useTeamAvatarSpeech } from '../hooks/useTeamAvatarSpeech';
import './AboutUsPage.css';

const TEAM_CATEGORIES = ['all', 'engineering', 'design', 'research', 'community'];
const getMemberAnchor = (index) => `team-member-${index + 1}`;

const normalizeSearchText = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

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

const TeamAvatarButton = ({ member, index, label, onSelect, speech, onSpeechDismiss }) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip
      delayDuration={150}
      open={Boolean(speech) || tooltipOpen}
      onOpenChange={(open) => {
        setTooltipOpen(open);
        if (!open && speech) onSpeechDismiss();
      }}
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={label}
          aria-controls="team-results"
          data-team-member-index={index}
          data-speaking={Boolean(speech)}
          className="about-team-avatar-button relative block aspect-square min-h-11 min-w-11 w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
        >
          <span className="relative isolate block h-full w-full overflow-hidden bg-[#f5f5f1]">
            <span className="about-team-avatar-portrait absolute inset-0 block">
              <img
                src={member.avatar}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="h-full w-full scale-[1.15] object-contain"
              />
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        key={speech?.id ?? 'name'}
        side="top"
        sideOffset={10}
        onEscapeKeyDown={() => {
          setTooltipOpen(false);
          onSpeechDismiss();
        }}
        className={speech
          ? 'about-team-speech-bubble max-w-56 rounded-2xl border border-[#304735] bg-[#f7efd9] px-4 py-1.5 font-mono text-sm font-semibold text-[#304735] shadow-[0_4px_0_rgba(48,71,53,0.12)] [&_svg]:bg-[#f7efd9] [&_svg]:fill-[#f7efd9]'
          : 'bg-[#304735] font-serif text-sm font-semibold text-[#eff7e9] [&_svg]:bg-[#304735] [&_svg]:fill-[#304735]'}
      >
        {speech?.quote ?? member.name}
      </TooltipContent>
    </Tooltip>
  );
};

const TeamMemberCard = React.memo(({ member, index, photoPlaceholderLabel, portraitAlt, cardRef }) => {
  const nameContent = (
    <>
      <span>{member.name}</span>
      {member.link ? (
        <ArrowUpRight
          aria-hidden="true"
          className="h-[0.8em] w-[0.8em] shrink-0"
        />
      ) : null}
    </>
  );

  return (
    <article
      ref={cardRef}
      id={getMemberAnchor(index)}
      className="flex h-full min-w-0 scroll-mt-24 flex-col bg-[#304735] px-5 py-3 text-[#eff7e9] shadow-[0_18px_45px_rgba(35,58,41,0.12)]"
    >
      {member.avatar ? (
        <div className="relative isolate aspect-[215/229] overflow-hidden bg-[#f3f2ec]">
          <img
            src={member.avatar}
            alt={portraitAlt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-[1.15] object-contain mix-blend-multiply"
          />
        </div>
      ) : (
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
      )}

      <div className="flex flex-1 flex-col px-1 pb-2 pt-4 font-serif">
        <h2 tabIndex={-1} className="text-[1.55rem] font-bold leading-none tracking-[0.01em] text-[#e7f9df] outline-none">
          {member.link ? (
            <a
              href={member.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1 underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7f9df]/70"
            >
              {nameContent}
            </a>
          ) : (
            <span className="underline decoration-1 underline-offset-2">{nameContent}</span>
          )}
        </h2>

        {member.role ? (
          <p className="mt-2 text-[1.05rem] font-bold leading-[1.2] text-white">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [pendingMemberIndex, setPendingMemberIndex] = useState(null);
  const searchInputRef = useRef(null);
  const memberCardRefs = useRef([]);
  const hero = t('about.hero', { returnObjects: true }) || {};
  const contactLinks = t('about.contactLinks', {
    returnObjects: true,
    email: import.meta.env.VITE_SUPPORT_EMAIL,
  }) || [];
  const team = useMemo(() => t('about.team', { returnObjects: true }) || {}, [t]);
  const categoryLabels = team.directory?.categories;

  const members = useMemo(
    () => (Array.isArray(team?.members) ? team.members : []),
    [team?.members]
  );

  const searchedMembers = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    const terms = query ? query.split(/\s+/) : [];

    return members.map((member, index) => ({ member, index })).filter(({ member }) => {
      const categories = member.categories || [];
      const searchableText = normalizeSearchText([
        member.name,
        member.role,
        member.bio,
        ...categories,
        ...categories.map((category) => categoryLabels?.[category]),
      ].filter(Boolean).join(' '));

      return terms.every((term) => searchableText.includes(term));
    });
  }, [members, searchQuery, categoryLabels]);

  const filteredMembers = activeCategory === 'all'
    ? searchedMembers
    : searchedMembers.filter(({ member }) => member.categories?.includes(activeCategory));
  const categoryCounts = Object.fromEntries(TEAM_CATEGORIES.map((category) => [
    category,
    category === 'all'
      ? searchedMembers.length
      : searchedMembers.filter(({ member }) => member.categories?.includes(category)).length,
  ]));
  const hasFilters = searchQuery.length > 0 || activeCategory !== 'all';
  const avatarMembers = useMemo(() => members.map((member, index) => ({ member, index }))
    .filter(({ member }) => member.avatar), [members]);
  const { navigationRef, activeSpeech, dismissSpeech } = useTeamAvatarSpeech(avatarMembers);

  useEffect(() => {
    if (pendingMemberIndex === null) {
      return;
    }

    const target = memberCardRefs.current[pendingMemberIndex];
    if (target) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.querySelector('h2')?.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
    setPendingMemberIndex(null);
  }, [pendingMemberIndex]);

  const jumpToMember = (index) => {
    if (!filteredMembers.some((entry) => entry.index === index)) {
      setSearchQuery('');
      setActiveCategory('all');
    }
    setPendingMemberIndex(index);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    searchInputRef.current?.focus();
  };

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

      <main className="mx-auto grid w-full max-w-[1600px] lg:grid-cols-[35%_65%] xl:grid-cols-[29%_71%]">
        <aside className="border-b border-[#2f7b3a]/70 px-6 py-14 sm:px-8 lg:border-b-0 lg:border-r lg:px-9 lg:py-12">
          <div className="lg:sticky lg:top-28 lg:max-h-[calc(100svh-8rem)] lg:overflow-y-auto">
            <h2 className="max-w-sm whitespace-pre-line font-serif text-5xl font-bold leading-[1.02] tracking-[0.01em] text-[#267b2f] sm:text-6xl lg:text-[3.25rem]">
              {team.displayTitle || team.title || 'Our Team'}
            </h2>

            <nav aria-label={team.contactNavigationLabel || team.title} className="mt-10 sm:mt-12">
              <ul className="flex flex-wrap gap-x-7 gap-y-4 lg:flex-col lg:items-start lg:gap-3">
                {contactLinks.map((item) => (
                  <li key={`${item.type}-${item.href}`}>
                    <a
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                      className="font-serif text-xl font-bold text-[#3b585d] underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#267b2f]/40"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {avatarMembers.length > 0 ? (
              <nav ref={navigationRef} aria-labelledby="team-avatar-nav-title" className="mt-4 max-w-sm font-serif">
                <h3 id="team-avatar-nav-title" className="text-2xl font-bold text-[#304735]">
                  {t('about.team.avatarNavigation.title')}
                </h3>
                <ul className="mt-15 grid grid-cols-5 gap-2">
                  {avatarMembers.map(({ member, index }) => (
                    <li key={member.name} className="min-w-0">
                      <TeamAvatarButton
                        member={member}
                        index={index}
                        label={t('about.team.avatarNavigation.jumpTo', { name: member.name })}
                        onSelect={jumpToMember}
                        speech={activeSpeech?.index === index ? activeSpeech : null}
                        onSpeechDismiss={dismissSpeech}
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm leading-relaxed text-[#3b585d]">
                  {t('about.team.avatarNavigation.hint')}
                </p>
              </nav>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 px-6 py-12 sm:px-10 lg:px-16 lg:py-10 2xl:px-20">
          {team.intro ? (
            <p className="max-w-3xl font-serif text-[1.75rem] font-bold leading-[1.08] tracking-[0.015em] text-[#3b585d] sm:text-4xl sm:leading-[1.02] lg:text-[2.35rem]">
              {team.intro}
            </p>
          ) : null}

          <div className="mt-10 space-y-5 border-b border-[#304735]/20 pb-5 font-serif">
            <div role="search" aria-label={t('about.team.directory.searchLabel')}>
              <label htmlFor="team-search" className="sr-only">
                {t('about.team.directory.searchLabel')}
              </label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#304735]/70" />
                <Input
                  ref={searchInputRef}
                  id="team-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('about.team.directory.searchPlaceholder')}
                  autoComplete="off"
                  aria-describedby="team-search-hint"
                  aria-controls="team-results"
                  className="h-12 appearance-none rounded-none border-[#304735]/35 bg-[#f3f2ec] pl-12 pr-12 text-base text-[#304735] placeholder:text-[#304735]/60 focus-visible:ring-[#304735]/45 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label={t('about.team.directory.clearSearch')}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#304735] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#304735]/60"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              <p id="team-search-hint" className="sr-only">
                {t('about.team.directory.searchHint')}
              </p>
            </div>

            <div role="group" aria-labelledby="team-filter-label" aria-describedby="team-filter-hint">
              <p className="mb-3 text-sm font-semibold text-[#304735]/80">
                <span id="team-filter-label">{t('about.team.directory.filterLabel')}</span>{' '}
                <span id="team-filter-hint" className="ml-2 font-normal">{t('about.team.directory.filterHint')}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {TEAM_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={activeCategory === category}
                    aria-controls="team-results"
                    onClick={() => setActiveCategory(category)}
                    className={`inline-flex min-h-11 items-center gap-2 border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#304735]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f5f1] ${
                      activeCategory === category
                        ? 'border-[#304735] bg-[#304735] text-[#eff7e9]'
                        : 'border-[#304735]/30 bg-transparent text-[#304735]'
                    }`}
                  >
                    <span>{t(`about.team.directory.categories.${category}`)}</span>
                    <span className="min-w-[2ch] text-right tabular-nums opacity-70">{categoryCounts[category]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-[#304735]">
              <p role="status" aria-live="polite" aria-atomic="true">
                {t('about.team.directory.results', { shown: filteredMembers.length, total: members.length })}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-11 px-1 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#304735]/60"
                >
                  {t('about.team.directory.clearFilters')}
                </button>
              ) : null}
            </div>
          </div>

          <div id="team-results" className="mt-8">
            {filteredMembers.length > 0 ? (
              <div className="grid items-stretch gap-x-10 gap-y-20 sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-12 xl:gap-y-24 2xl:gap-x-14 2xl:gap-y-28">
                {filteredMembers.map(({ member, index }) => (
                  <TeamMemberCard
                    key={member.name}
                    member={member}
                    index={index}
                    photoPlaceholderLabel={t('about.team.photoPlaceholder', { name: member.name })}
                    portraitAlt={t('about.team.portraitAlt', { name: member.name })}
                    cardRef={(element) => { memberCardRefs.current[index] = element; }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center border border-dashed border-[#304735]/30 px-6 py-16 text-center font-serif text-[#304735]">
                <SearchX aria-hidden="true" className="mb-4 h-9 w-9 opacity-60" strokeWidth={1.5} />
                <h3 className="text-2xl font-bold">{t('about.team.directory.emptyTitle')}</h3>
                <p className="mt-3 max-w-sm text-base">{t('about.team.directory.emptyDescription')}</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 min-h-11 border border-[#304735] bg-[#304735] px-5 py-2 font-semibold text-[#eff7e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#304735]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f5f1]"
                >
                  {t('about.team.directory.resetButton')}
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AboutUsPage;
