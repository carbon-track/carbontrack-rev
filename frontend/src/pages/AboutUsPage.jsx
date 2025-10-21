import React, { useMemo, useRef } from 'react';
import { Mail, Instagram, MessagesSquare, Handshake, ArrowUpRight } from 'lucide-react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
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

// Timeline Card Component with Apple-style animations
const TimelineCard = ({ member, index, isLeft, t }) => {
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { 
    once: false, 
    margin: "-100px",
    amount: 0.4 
  });

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "center center"]
  });

  const y = useTransform(scrollYProgress, [0, 0.5, 1], [80, 0, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0, 1, 1, 1, 0.3]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [isLeft ? 25 : -25, 0, isLeft ? -15 : 15]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1.05, 0.95]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative grid md:grid-cols-2 gap-8 items-center",
        isLeft ? "md:pr-12" : "md:pl-12"
      )}
    >
      {/* Card positioned on alternating sides */}
      <motion.div
        className={cn(
          "relative",
          isLeft ? "md:col-start-1 md:text-right" : "md:col-start-2"
        )}
        style={{ 
          y,
          opacity,
          scale
        }}
        initial={{ opacity: 0, x: isLeft ? -100 : 100, rotateY: isLeft ? 30 : -30 }}
        animate={isInView ? { 
          opacity: 1, 
          x: 0,
          rotateY: 0,
        } : {
          opacity: 0,
          x: isLeft ? -100 : 100,
          rotateY: isLeft ? 30 : -30,
        }}
        transition={{
          duration: 1.2,
          delay: index * 0.1,
          ease: [0.22, 1, 0.36, 1]
        }}
      >
        <motion.div
          style={{
            rotateY,
            transformStyle: "preserve-3d",
          }}
          animate={isInView ? {
            rotateY: [isLeft ? 15 : -15, 0, isLeft ? -3 : 3, 0],
            scale: [0.95, 1.02, 1],
            transition: {
              duration: 1.5,
              delay: index * 0.1 + 0.3,
              ease: [0.22, 1, 0.36, 1]
            }
          } : {}}
          whileHover={{ 
            scale: 1.03,
            rotateY: isLeft ? -5 : 5,
            z: 50,
            transition: { 
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1]
            }
          }}
        >
          <Card
            className="group relative overflow-hidden bg-white/90 backdrop-blur-xl border-none shadow-2xl hover:shadow-3xl transition-all duration-500"
            style={{
              transformStyle: "preserve-3d",
              transform: "translateZ(0)"
            }}
          >
            {/* Gradient Overlay */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-blue-500/5 to-purple-500/5"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: [0, 0.5, 1, 0.7] } : { opacity: 0 }}
              transition={{ 
                duration: 2,
                delay: index * 0.1 + 0.5,
                ease: [0.22, 1, 0.36, 1]
              }}
            />
            
            {/* Animated Border */}
            <motion.div
              className="absolute inset-0 rounded-lg"
              style={{
                background: "linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6)",
                padding: "2px",
              }}
              initial={{ opacity: 0 }}
              animate={isInView ? { 
                opacity: [0, 0, 0.8, 0.5],
              } : { opacity: 0 }}
              transition={{ 
                duration: 1.5,
                delay: index * 0.1 + 0.6,
                ease: [0.22, 1, 0.36, 1]
              }}
              whileHover={{ opacity: 1 }}
            >
              <div className="h-full w-full rounded-lg bg-white" />
            </motion.div>

            <div className="relative" style={{ transform: "translateZ(50px)" }}>
              <CardHeader className="pb-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.15 + 0.2,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <CardTitle className="text-2xl md:text-3xl text-gray-900 font-bold mb-2">
                    {member.name}
                  </CardTitle>
                  {member.role && (
                    <CardDescription className="text-base md:text-lg bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                      {member.role}
                    </CardDescription>
                  )}
                </motion.div>
              </CardHeader>
              
              <CardContent className="text-gray-700 space-y-4">
                <motion.p
                  className="leading-relaxed text-base md:text-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.15 + 0.3,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  {member.bio}
                </motion.p>
                
                {member.link && (
                  <motion.a
                    href={member.link}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({
                        size: 'lg',
                        className:
                          'w-full justify-center bg-gradient-to-r from-green-500 to-blue-500 text-white border-none shadow-lg hover:shadow-xl group-hover:from-green-600 group-hover:to-blue-600',
                      })
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ 
                      duration: 0.6, 
                      delay: index * 0.15 + 0.4,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="mr-2">
                      {member.linkLabel || t('about.team.learnMore', 'Learn More')}
                    </span>
                    <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </motion.a>
                )}
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* Decorative Elements */}
        <motion.div
          className="absolute -z-10 inset-0 bg-gradient-to-br from-green-200/30 to-blue-200/30 blur-3xl rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ 
            duration: 1, 
            delay: index * 0.15 + 0.5,
            ease: [0.22, 1, 0.36, 1]
          }}
        />
      </motion.div>
    </div>
  );
};

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
        <section className="max-w-7xl mx-auto">
          <motion.div 
            className="mb-16 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {team?.title || 'Our Team'}
            </h2>
            {team?.intro && (
              <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
                {team.intro}
              </p>
            )}
          </motion.div>

          {/* Timeline Container */}
          <div className="relative">
            {/* Central Timeline Line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 transform -translate-x-1/2" />
            
            {/* Timeline Dots */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 transform -translate-x-1/2">
              {groupedMembers.map((_, index) => (
                <motion.div
                  key={index}
                  className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 shadow-lg"
                  style={{ 
                    top: `${(index / (groupedMembers.length - 1 || 1)) * 100}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-500 to-blue-500 animate-ping opacity-75" />
                </motion.div>
              ))}
            </div>

            {/* Timeline Items */}
            <div className="space-y-24 md:space-y-32">
              {groupedMembers.map((member, index) => (
                <TimelineCard
                  key={member.name}
                  member={member}
                  index={index}
                  isLeft={index % 2 === 0}
                  t={t}
                />
              ))}
            </div>
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
