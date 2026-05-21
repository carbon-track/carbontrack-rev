import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { isSafeHtmlUri } from '../../lib/safeUrl';
import { cn } from '../../lib/utils';

function isSafeMarkdownHref(href) {
  if (typeof href !== 'string') {
    return false;
  }

  const trimmed = href.trim();
  if (trimmed === '' || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return false;
  }

  for (const char of trimmed) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return false;
    }
  }

  if (/^\.{1,2}\//.test(trimmed)) {
    return true;
  }

  return isSafeHtmlUri(trimmed);
}

export default function AdminAiMarkdown({ content, className }) {
  const text = typeof content === 'string' ? content : String(content ?? '');
  if (text.trim() === '') {
    return null;
  }

  return (
    <div className={cn('min-w-0 max-w-none break-words text-sm leading-7', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-0 text-xl font-semibold leading-8">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold leading-7">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold leading-7">{children}</h3>,
          p: ({ children }) => <p className="mb-4 leading-7 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-current/30 pl-3 italic opacity-90">{children}</blockquote>
          ),
          img: () => null,
          a: ({ href, children }) => {
            if (href === '' || (href && !isSafeMarkdownHref(href))) {
              return <span>{children}</span>;
            }

            const opensNewWindow = /^https?:\/\//i.test(href || '');

            return (
              <a
                href={href}
                target={opensNewWindow ? '_blank' : undefined}
                rel={opensNewWindow ? 'noreferrer noopener' : undefined}
                className="font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
              >
                {children}
              </a>
            );
          },
          code: ({ className, children }) => {
            const rawCode = String(children ?? '');
            const isBlock = /language-/.test(className || '') || rawCode.includes('\n');

            return isBlock ? (
              <code className="block overflow-x-auto whitespace-pre rounded-2xl border border-current/10 bg-current/5 px-3 py-3 font-mono text-xs leading-5 text-current">
                {children}
              </code>
            ) : (
              <code className="rounded-md border border-current/10 bg-current/10 px-1.5 py-0.5 font-mono text-[0.9em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-3 overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-2xl border border-current/10">
              <table className="min-w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-current/10 bg-current/5 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-current/10 px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-current/10" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
