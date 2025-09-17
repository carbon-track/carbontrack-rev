import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Calculator, Award, Users, TrendingUp, Shield } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { checkAuthStatus } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

const StatsSection = React.lazy(() => import('../sections/StatsSection'));
const FeaturesSection = React.lazy(() => import('../sections/FeaturesSection'));
const HowItWorksSection = React.lazy(() => import('../sections/HowItWorksSection'));
const TrustSection = React.lazy(() => import('../sections/TrustSection'));

function SkeletonBlock({ className='' }) { return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />; }
function SectionSkeleton() { return (
  <div className="py-16 px-4"><div className="max-w-7xl mx-auto space-y-6">
    <SkeletonBlock className="h-8 w-1/3" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({length:4}).map((_,i)=>(<SkeletonBlock key={i} className="h-32"/>))}
    </div>
  </div></div>
); }

export default function HomePage() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const checkAuth = async () => {
      const authStatus = await checkAuthStatus();
      setIsAuthenticated(authStatus.isAuthenticated);
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Leaf className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              {t('home.hero.title')}
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              {t('home.hero.subtitle')}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    {t('home.hero.goToDashboard')}
                  </Button>
                </Link>
                <Link to="/calculate">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t('home.hero.recordActivity')}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    {t('home.hero.getStarted')}
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t('home.hero.signIn')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

  <Suspense fallback={<SectionSkeleton />}> <StatsSection /> </Suspense>

  <Suspense fallback={<SectionSkeleton />}> <FeaturesSection /> </Suspense>

  <Suspense fallback={<SectionSkeleton />}> <HowItWorksSection /> </Suspense>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-green-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            {t('home.cta.title')}
          </h2>
          <p className="text-xl text-green-100 mb-8">
            {t('home.cta.subtitle')}
          </p>
          
          {!isAuthenticated && (
            <Link to="/auth/register">
              <Button size="lg" variant="secondary">
                {t('home.cta.joinNow')}
              </Button>
            </Link>
          )}
        </div>
      </section>

  <Suspense fallback={<SectionSkeleton />}> <TrustSection /> </Suspense>
    </div>
  );
}
