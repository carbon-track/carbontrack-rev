import React, { useMemo } from 'react';
import { Mail, Instagram, MessagesSquare, Handshake, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { buttonVariants } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { cn } from '../lib/utils';

const CONTACT_ICON_MAP = {
  email: Mail,
  instagram: Instagram,
  discord: MessagesSquare,
  partnership: Handshake,
};

const DEFAULT_ICON = ArrowUpRight;

const AboutUsPage = () => {
  const { t } = useTranslation();
  const hero = t('about.hero', { returnObjects: true }) || {};
  const contactLinks = t('about.contactLinks', { returnObjects: true }) || [];
  const team = t('about.team', { returnObjects: true }) || {};
  const mission = t('about.mission', { returnObjects: true }) || {};
  const achievements = t('about.achievements', { returnObjects: true }) || {};
  const specialThanks = t('about.specialThanks', { returnObjects: true }) || {};

  const groupedMembers = useMemo(() => {
    if (!Array.isArray(team?.members)) {
      return [];
    }
    return team.members;
  }, [team?.members]);

  const achievementStats = useMemo(() => {
    if (!Array.isArray(achievements?.stats)) {
      return [];
    }
    return achievements.stats;
  }, [achievements?.stats]);

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-green-50 via-white to-blue-50" />
      <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-green-200/40 blur-3xl -z-10" />
      <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl -z-10" />

      <header className="relative px-4 py-24">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {hero.title || 'About CarbonTrack'}
          </h1>
          {hero.subtitle && (
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8">
              {hero.subtitle}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            {contactLinks.map((item) => {
              const Icon = CONTACT_ICON_MAP[item.type] || DEFAULT_ICON;
              return (
                <a
                  key={`${item.type}-${item.href}`}
                  className={cn(
                    buttonVariants({
                      size: 'lg',
                      className:
                        'bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:from-green-600 hover:to-blue-600 hover:shadow-xl',
                    }),
                    'justify-center'
                  )}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </header>

      <main className="px-4 pb-24 space-y-20">
        <section className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              {team?.title || 'Our Team'}
            </h2>
            {team?.intro && (
              <p className="text-gray-600 max-w-3xl mx-auto">
                {team.intro}
              </p>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupedMembers.map((member) => (
              <Card
                key={member.name}
                className="bg-white/80 backdrop-blur border-none shadow-lg shadow-green-100 hover:shadow-xl transition-shadow duration-300 h-full flex flex-col"
              >
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-gray-900">{member.name}</CardTitle>
                  {member.role && (
                    <CardDescription className="text-green-600 font-medium">
                      {member.role}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="text-gray-600 flex-1 flex flex-col">
                  <p className="leading-relaxed text-sm md:text-base">
                    {member.bio}
                  </p>
                  {member.link && (
                    <a
                      href={member.link}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({
                          variant: 'secondary',
                          className: 'mt-6 w-full justify-center',
                        })
                      )}
                    >
                      {member.linkLabel || t('about.team.learnMore', 'Learn More')}
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto">
          <Card className="bg-white/80 backdrop-blur border-none shadow-lg shadow-blue-100">
            <CardHeader>
              <CardTitle className="text-3xl text-gray-900">
                {mission?.title || 'Our Mission'}
              </CardTitle>
              {mission?.description && (
                <CardDescription className="text-base text-gray-600">
                  {mission.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {(mission?.items || []).map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
                    <span className="text-gray-700 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              {achievements?.title || 'Our Achievements'}
            </h2>
            {achievements?.description && (
              <p className="text-gray-600 max-w-3xl mx-auto">
                {achievements.description}
              </p>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {achievementStats.map((stat) => (
              <Card
                key={stat.label}
                className="bg-white/80 backdrop-blur border-none shadow-lg shadow-purple-100 hover:shadow-xl transition-shadow duration-300"
              >
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900">{stat.label}</CardTitle>
                  {stat.highlight && (
                    <CardDescription className="text-green-600 font-semibold">
                      {stat.highlight}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {stat.value && (
                    <div className="text-3xl font-bold text-gray-900 mb-4">
                      {stat.value}
                    </div>
                  )}
                  {stat.description && (
                    <p className="text-gray-600 leading-relaxed">
                      {stat.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-pink-500 to-orange-400 text-white border-none shadow-2xl">
            <CardHeader>
              <CardTitle className="text-3xl">
                {specialThanks?.title || 'Special Thanks'}
              </CardTitle>
              {specialThanks?.subtitle && (
                <CardDescription className="text-white/80 text-base">
                  {specialThanks.subtitle}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {specialThanks?.description && (
                <p className="text-white/90 leading-relaxed">
                  {specialThanks.description}
                </p>
              )}
              {specialThanks?.link && (
                <a
                  href={specialThanks.link}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({
                      variant: 'secondary',
                      className:
                        'bg-white text-pink-600 hover:bg-white/90 border-none justify-center',
                    })
                  )}
                >
                  {specialThanks.linkLabel || t('about.specialThanks.visit', 'Visit Website')}
                </a>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AboutUsPage;
