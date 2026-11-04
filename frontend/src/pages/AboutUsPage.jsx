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
          <span className="relative isolate block h-full w-full overflow-hidden bg-background">
            <span className="about-team-avatar-portrait absolute inset-0 block">
              <img
                src={member.avatar}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="h-full w-full scale-[1.15] object-contain dark:invert"
              />
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        key={speech?.id ?? 'name'}
        side="top"
        sideOffset={speech ? 2 : 10}
        arrow={speech ? (
          <svg
            aria-hidden="true"
            width="28"
            height="18"
            viewBox="0 0 28 18"
            className="about-team-speech-tail"
          >
            <path
              d="M1 0 L14 17 L27 0"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        ) : undefined}
        onEscapeKeyDown={() => {
          setTooltipOpen(false);
          onSpeechDismiss();
        }}
        className={speech
          ? 'about-team-speech-bubble max-w-56 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-1.5 font-mono text-sm font-semibold text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200'
          : 'bg-card text-sm font-semibold text-foreground shadow-sm [&_svg]:bg-card [&_svg]:fill-card'}
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
      className="flex h-full min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-black/5 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      {member.avatar ? (
        <div className="relative isolate aspect-[215/229] overflow-hidden bg-muted">
          <img
            src={member.avatar}
            alt={portraitAlt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-[1.15] object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
          />
        </div>
      ) : (
        <div
          role="img"
          aria-label={photoPlaceholderLabel}
          className={`relative flex aspect-[215/229] items-center justify-center overflow-hidden bg-gradient-to-br ${PORTRAIT_PLACEHOLDERS[index % PORTRAIT_PLACEHOLDERS.length]}`}
        >
          <div className="absolute -left-10 top-5 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute -bottom-14 right-0 h-40 w-40 rounded-full bg-blue-900/20 blur-2xl" />
          <UserRound aria-hidden="true" className="relative h-20 w-20 text-white/60" strokeWidth={1.1} />
          <span className="absolute bottom-4 right-4 text-xl font-bold tracking-[0.12em] text-white/80">
            {getMemberInitials(member.name)}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h2 tabIndex={-1} className="text-xl font-semibold leading-tight text-foreground outline-none">
          {member.link ? (
            <a
              href={member.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1 underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {nameContent}
            </a>
          ) : (
            <span className="underline decoration-1 underline-offset-2">{nameContent}</span>
          )}
        </h2>

        {member.role ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-600 dark:text-emerald-300">
            {member.role}
          </p>
        ) : null}

        {member.bio ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {member.bio}
          </p>
        ) : null}
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
    <div className="relative min-h-screen overflow-clip bg-background text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 blur-[100px] dark:from-primary/20 dark:via-primary/10 dark:opacity-20" />
      <header className="relative mx-4 overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 px-6 py-16 shadow-sm sm:mx-6 sm:px-10 sm:py-20 lg:mx-auto lg:max-w-7xl">
        <img
          src="/images/about/people-hero.png"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-y-0 right-0 -z-10 h-full w-3/5 object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent" />
        <div className="relative max-w-3xl text-center sm:text-left">
          <h1 className="bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-5xl">
            {hero.displayTitle || hero.title || 'People'}
          </h1>
          {hero.subtitle ? (
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-xl">
              {hero.subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-black/5 bg-card p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none lg:sticky lg:top-24">
          <div className="about-team-sidebar-scroll lg:sticky lg:top-28 lg:max-h-[calc(100svh-8rem)] lg:overflow-x-hidden lg:overflow-y-auto">
            <h2 className="max-w-sm whitespace-pre-line bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-4xl">
              {team.displayTitle || team.title || 'Our Team'}
            </h2>

            <nav aria-label={team.contactNavigationLabel || team.title} className="mt-8">
              <ul className="flex flex-wrap gap-x-7 gap-y-4 lg:flex-col lg:items-start lg:gap-3">
                {contactLinks.map((item) => (
                  <li key={`${item.type}-${item.href}`}>
                    <a
                      href={item.href}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                      className="text-sm font-medium text-foreground underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {avatarMembers.length > 0 ? (
              <nav ref={navigationRef} aria-labelledby="team-avatar-nav-title" className="mt-8 max-w-sm">
                <h3 id="team-avatar-nav-title" className="text-lg font-semibold text-foreground">
                  {t('about.team.avatarNavigation.title')}
                </h3>
                <ul className="mt-4 grid grid-cols-5 gap-2">
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
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {t('about.team.avatarNavigation.hint')}
                </p>
              </nav>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          {team.intro ? (
            <p className="max-w-3xl bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-500 bg-clip-text text-3xl font-bold leading-tight text-transparent sm:text-4xl">
              {team.intro}
            </p>
          ) : null}

          <div className="mt-8 space-y-5 rounded-2xl border border-black/5 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div role="search" aria-label={t('about.team.directory.searchLabel')}>
              <label htmlFor="team-search" className="sr-only">
                {t('about.team.directory.searchLabel')}
              </label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
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
                  className="h-12 appearance-none rounded-full border-input bg-background pl-12 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label={t('about.team.directory.clearSearch')}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              <p id="team-search-hint" className="sr-only">
                {t('about.team.directory.searchHint')}
              </p>
            </div>

            <div role="group" aria-labelledby="team-filter-label">
              <p className="mb-3 text-sm font-semibold text-muted-foreground">
                <span id="team-filter-label">{t('about.team.directory.filterLabel')}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {TEAM_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={activeCategory === category}
                    aria-controls="team-results"
                    onClick={() => setActiveCategory(category)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      activeCategory === category
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-border bg-background text-foreground hover:border-emerald-300'
                    }`}
                  >
                    <span>{t(`about.team.directory.categories.${category}`)}</span>
                    <span className="min-w-[2ch] text-right tabular-nums opacity-70">{categoryCounts[category]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <p role="status" aria-live="polite" aria-atomic="true">
                {t('about.team.directory.results', { shown: filteredMembers.length, total: members.length })}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-11 px-1 font-semibold text-emerald-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
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
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-foreground shadow-sm">
                <SearchX aria-hidden="true" className="mb-4 h-9 w-9 opacity-60" strokeWidth={1.5} />
                <h3 className="text-2xl font-bold">{t('about.team.directory.emptyTitle')}</h3>
                <p className="mt-3 max-w-sm text-base">{t('about.team.directory.emptyDescription')}</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 min-h-11 rounded-full bg-primary px-5 py-2 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
