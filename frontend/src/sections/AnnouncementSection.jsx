import React from 'react';
import { Megaphone, Award, Leaf, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';

const ICONS = {
  feedback: Megaphone,
  rewards: Award,
  community: Leaf,
  integrity: Shield,
};

export default function AnnouncementSection() {
  const { t } = useTranslation();
  const announcements = t('home.announcements.items', { returnObjects: true }) || [];

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-white to-blue-50/40">
      <div className="max-w-6xl mx-auto">
        <Card className="bg-white/80 backdrop-blur-lg border-none shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-blue-600 bg-clip-text text-transparent">
              {t('home.announcements.title')}
            </CardTitle>
            <p className="text-gray-600">{t('home.announcements.subtitle')}</p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {announcements.map((item, index) => {
              const Icon = ICONS[item.id] ?? Megaphone;
              return (
                <div
                  key={item.id || index}
                  className={cn(
                    'group relative rounded-2xl border border-transparent bg-white/70 p-6 shadow-sm transition-all duration-300',
                    'hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
