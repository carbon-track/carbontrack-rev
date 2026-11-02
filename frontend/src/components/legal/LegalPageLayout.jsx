import PropTypes from 'prop-types';

export function LegalPageLayout({ title, lastUpdated, intro, children }) {
  return (
    <div className="min-h-screen bg-[#f5f5f1] text-[#304735]">
      <header className="border-b border-[#304735]/20">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 lg:py-20">
          {lastUpdated ? (
            <p className="text-sm font-semibold tracking-[0.12em] text-[#267b2f]">
              {lastUpdated}
            </p>
          ) : null}
          <h1 className="mt-4 max-w-4xl font-serif text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {title}
          </h1>
          {intro ? (
            <div className="mt-6 max-w-3xl text-base leading-7 text-[#3b585d] sm:text-lg">
              {intro}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 lg:py-16">
        <article>{children}</article>
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
    <section className="border-t border-[#304735]/20 py-8 first:border-t-0 first:pt-0 last:pb-0">
      <h2 className="flex items-center gap-3 font-serif text-2xl font-bold leading-tight sm:text-3xl">
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#e9ede3] text-[#267b2f]">
            <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </span>
        ) : null}
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-base leading-7 text-[#3b585d]">
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
