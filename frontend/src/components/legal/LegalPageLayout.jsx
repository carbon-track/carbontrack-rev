import PropTypes from 'prop-types';

export function LegalPageLayout({ title, lastUpdated, intro, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 bg-gradient-to-tr from-blue-50/50 via-gray-100/50 to-transparent opacity-50 blur-[100px] dark:from-primary/20 dark:via-primary/10 dark:opacity-20" />
      <header className="relative px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl text-center">
          {lastUpdated ? (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
              {lastUpdated}
            </p>
          ) : null}
          <h1 className="mx-auto mt-4 max-w-4xl bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent dark:from-white dark:to-white/60 sm:text-5xl">
            {title}
          </h1>
          {intro ? (
            <div className="mx-auto mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {intro}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:pb-24">
        <article className="rounded-2xl border border-black/5 bg-card p-6 text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-md sm:p-10">
          {children}
        </article>
      </div>
    </div>
  );
}

LegalPageLayout.propTypes = {
  title: PropTypes.node.isRequired,
  lastUpdated: PropTypes.node,
  intro: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export function LegalSection({ title, icon: Icon, children }) {
  return (
    <section className="border-t border-border/70 py-8 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="flex items-center gap-3 text-xl font-semibold leading-tight sm:text-2xl">
        {Icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600 dark:from-emerald-500/10 dark:to-blue-500/10 dark:text-emerald-300">
            <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </span>
        ) : null}
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-base leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

LegalSection.propTypes = {
  title: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node,
};
