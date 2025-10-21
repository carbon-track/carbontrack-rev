import React from 'react';
import { Leaf, BarChart2, Gift, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';

const ICONS = {
  footprint: Leaf,
  analytics: BarChart2,
  rewards: Gift,
  community: Users,
};

export default function FeatureShowcaseSection() {
  const { t } = useTranslation();
  const cards = t('home.featureShowcase.cards', { returnObjects: true }) || [];

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-blue-50 via-white to-emerald-50/60">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
            {t('home.featureShowcase.title')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t('home.featureShowcase.subtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = ICONS[card.id] ?? Leaf;
            return (
              <Card
                key={card.id || index}
                className={cn(
                  'relative overflow-hidden border-none shadow-lg transition-transform duration-500 hover:-translate-y-1',
                  index % 2 === 0
                    ? 'bg-white/85 backdrop-blur'
                    : 'bg-gradient-to-br from-blue-600 to-emerald-500 text-white'
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 opacity-[0.05]',
                    index % 2 === 0 ? 'bg-[radial-gradient(circle_at_top,#22d3ee,transparent_60%)]' : ''
                  )}
                />
                <CardHeader className="relative flex flex-row items-start gap-4">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl',
                    index % 2 === 0
                      ? 'bg-gradient-to-br from-emerald-100 to-blue-100 text-emerald-600'
                      : 'bg-white/20 text-white'
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className={cn(
                      'text-xl font-semibold',
                      index % 2 !== 0 && 'text-white'
                    )}>
                      {card.title}
                    </CardTitle>
                    {card.subtitle && (
                      <CardDescription className={cn(
                        index % 2 === 0 ? 'text-gray-600' : 'text-white/70'
                      )}>
                        {card.subtitle}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative space-y-3 text-sm leading-relaxed">
                  <p className={cn(
                    index % 2 === 0 ? 'text-gray-600' : 'text-white/90'
                  )}>
                    {card.description}
                  </p>
                  {Array.isArray(card.highlights) && (
                    <ul className="space-y-2">
                      {card.highlights.map((highlight, highlightIndex) => (
                        <li
                          key={highlightIndex}
                          className={cn(
                            'flex items-start gap-2',
                            index % 2 === 0 ? 'text-gray-700' : 'text-white/90'
                          )}
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
