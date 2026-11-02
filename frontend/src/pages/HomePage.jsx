import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus } from '../lib/auth';
import { Button } from '../components/ui/Button';
import FloatingActionButton from '../components/common/FloatingActionButton';
import ViewportDeferred from '../components/common/ViewportDeferred';

const HeroCarousel = React.lazy(() => import('../components/home/HeroCarousel'));
const StatsSection = React.lazy(() => import('../sections/StatsSection'));
const FeaturesSection = React.lazy(() => import('../sections/FeaturesSection'));
const HowItWorksSection = React.lazy(() => import('../sections/HowItWorksSection'));
const TrustSection = React.lazy(() => import('../sections/TrustSection'));
const AnnouncementSection = React.lazy(() => import('../sections/AnnouncementSection'));
const FeatureShowcaseSection = React.lazy(() => import('../sections/FeatureShowcaseSection'));

function SkeletonBlock({ className='' }) { return <div className={`animate-pulse rounded bg-muted ${className}`} />; }
function SectionSkeleton() { return (
  <div className="px-4 py-12 sm:py-16"><div className="mx-auto max-w-7xl space-y-6">
    <SkeletonBlock className="h-8 w-2/3 sm:w-1/3" />
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-6 md:grid-cols-4">
      {Array.from({length:4}).map((_,i)=>(<SkeletonBlock key={i} className="h-32"/>))}
    </div>
  </div></div>
); }

function StaticHeroShowcase({ item }) {
  if (!item) {
    return null;
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative min-h-[260px] overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-secondary/35 shadow-sm sm:min-h-[280px] md:min-h-[320px]">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 px-6 py-10 text-center sm:px-8 sm:py-12 md:px-16 md:py-16">
          <h3 className="mb-4 text-xl font-bold leading-tight text-emerald-600 sm:text-2xl md:text-3xl lg:text-4xl">
            {item.title}
          </h3>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg lg:text-xl">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function scheduleIdleTask(callback, delayMs = 0) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }

  let idleHandle = null;
  const timeoutHandle = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(callback, { timeout: 1500 });
      return;
    }

    callback();
  }, delayMs);

  return () => {
    window.clearTimeout(timeoutHandle);
    if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleHandle);
    }
  };
}

export default function HomePage() {
  const { t } = useTranslation(['home']);
  const heroContainerRef = React.useRef(null);
  const [isHeroVisible, setIsHeroVisible] = React.useState(false);
  const [shouldEnhanceHero, setShouldEnhanceHero] = React.useState(false);
  const [isAuthenticated] = React.useState(() => checkAuthStatus().isAuthenticated);
  const heroHighlights = React.useMemo(() => {
    const result = t('home.hero.highlights', { returnObjects: true });
    return Array.isArray(result) ? result : [];
  }, [t]);
  const primaryHeroHighlight = heroHighlights[0] ?? null;

  React.useEffect(() => {
    const node = heroContainerRef.current;
    if (!node) {
      return undefined;
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      setIsHeroVisible(true);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsHeroVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (shouldEnhanceHero || !isHeroVisible || heroHighlights.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const cancelIdleTask = scheduleIdleTask(() => {
      if (cancelled) {
        return;
      }

      if (typeof React.startTransition === 'function') {
        React.startTransition(() => setShouldEnhanceHero(true));
        return;
      }

      setShouldEnhanceHero(true);
    }, 1200);

    return () => {
      cancelled = true;
      cancelIdleTask();
    };
  }, [heroHighlights.length, isHeroVisible, shouldEnhanceHero]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 blur-[100px] bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 dark:from-primary/20 dark:via-primary/10 dark:opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative px-4 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Leaf className="mx-auto mb-4 h-12 w-12 text-primary sm:h-16 sm:w-16" />
            <h1 className="mb-6 text-balance break-words bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-5xl">
              {t('home.hero.title')}
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-pretty text-base text-muted-foreground sm:text-xl">
              {t('home.hero.subtitle')}
            </p>
          </div>
          
          {/* 新的轮播图组件 */}
          {heroHighlights.length > 0 && (
            <div className="mb-12" ref={heroContainerRef}>
              {shouldEnhanceHero ? (
                <Suspense fallback={<StaticHeroShowcase item={primaryHeroHighlight} />}>
                  <HeroCarousel items={heroHighlights} interval={5000} />
                </Suspense>
              ) : (
                <StaticHeroShowcase item={primaryHeroHighlight} />
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {t('home.hero.goToDashboard')}
                  </Button>
                </Link>
                <Link to="/calculate">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {t('home.hero.recordActivity')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/register">
                  <Button size="lg" className="w-full sm:w-auto rounded-full shadow-sm hover:scale-105 transition-all duration-300">
                    {t('home.hero.getStarted')}
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full bg-white/5 backdrop-blur-md border-black/5 dark:border-white/10 hover:scale-105 transition-all duration-300">
                    {t('home.hero.signIn')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <StatsSection />
        </Suspense>
      </ViewportDeferred>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <AnnouncementSection />
        </Suspense>
      </ViewportDeferred>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <FeatureShowcaseSection />
        </Suspense>
      </ViewportDeferred>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <FeaturesSection />
        </Suspense>
      </ViewportDeferred>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <HowItWorksSection />
        </Suspense>
      </ViewportDeferred>

      {/* CTA Section */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        {/* CTA Glow */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-primary/5 dark:to-primary/10 pointer-events-none" />
        <div className="mx-auto max-w-4xl rounded-lg border border-black/5 bg-card p-6 text-center text-card-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-md sm:p-12">
          <h2 className="mb-4 bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-3xl">
            {t('home.cta.title')}
          </h2>
          <p className="mb-8 text-base text-muted-foreground sm:text-xl">
            {t('home.cta.subtitle')}
          </p>
          
          {!isAuthenticated && (
            <Link to="/auth/register">
              <Button size="lg" className="w-full rounded-full shadow-sm transition-all duration-300 hover:scale-105 sm:w-auto">
                {t('home.cta.joinNow')}
              </Button>
            </Link>
          )}
        </div>
      </section>

      <ViewportDeferred fallback={<SectionSkeleton />}>
        <Suspense fallback={<SectionSkeleton />}>
          <TrustSection />
        </Suspense>
      </ViewportDeferred>

      <FloatingActionButton />
    </div>
  );
}
