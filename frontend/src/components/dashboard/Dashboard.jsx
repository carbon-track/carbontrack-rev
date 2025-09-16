import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Leaf, Award, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { carbonAPI } from '../../lib/api';
import { checkAuthStatus } from '../../lib/auth';
import { StatsCard } from './StatsCard';
import { ActivityChart } from './ActivityChart';
import { RecentActivities } from './RecentActivities';
import { QuickActions } from './QuickActions';
import { Alert, AlertDescription } from '../ui/Alert';

export function Dashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const didFetchRef = useRef(false);

  // 先声明，供后续 useEffect 使用，避免 TDZ 报错
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 并行获取仪表板数据
      const [statsResponse, chartResponse, activitiesResponse] = await Promise.all([
        carbonAPI.getUserStats(),
        carbonAPI.getChartData({ period: 30 }),
        carbonAPI.getRecentActivities({ limit: 10 })
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      if (chartResponse.data.success) {
        setChartData(chartResponse.data.data);
      }

      if (activitiesResponse.data.success) {
        setRecentActivities(activitiesResponse.data.data);
      }
    } catch (err) {
      setError(err.message || t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // 防止在开发模式下 StrictMode 导致的重复执行
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    const { user: currentUser } = checkAuthStatus();
    if (currentUser) {
      setUser(currentUser);
      fetchDashboardData();
    } else {
      setError(t('dashboard.notLoggedIn'));
      setLoading(false);
    }
  }, [t, fetchDashboardData]);


  const handleQuickAction = (action) => {
    // 处理快速操作点击
    if (action.href) {
      window.location.href = action.href;
    }
  };

  const handleViewAllActivities = () => {
    window.location.href = '/activities';
  };

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 欢迎标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('dashboard.welcome')}{user?.username && `, ${user.username}`}！
          </h1>
          <p className="text-gray-600 mt-1">
            {t('dashboard.welcomeDesc')}
          </p>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
          <span>{t('dashboard.lastLogin')}:</span>
          <span>{user?.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : t('dashboard.firstTime')}</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={t('dashboard.totalPoints')}
          value={stats.total_points || 0}
          unit={t('dashboard.points')}
          change={stats.points_change}
          changeType={stats.points_change > 0 ? 'increase' : stats.points_change < 0 ? 'decrease' : 'neutral'}
          icon={Award}
          color="blue"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.carbonSaved')}
          value={stats.total_carbon_saved || 0}
          unit="kg CO₂"
          change={stats.carbon_change}
          changeType={stats.carbon_change > 0 ? 'increase' : stats.carbon_change < 0 ? 'decrease' : 'neutral'}
          icon={Leaf}
          color="green"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.activitiesCount')}
          value={stats.total_activities || 0}
          unit={t('dashboard.activities')}
          change={stats.activities_change}
          changeType={stats.activities_change > 0 ? 'increase' : stats.activities_change < 0 ? 'decrease' : 'neutral'}
          icon={TrendingUp}
          color="orange"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.rank')}
          value={stats.rank || '-'}
          unit={stats.total_users ? `/ ${stats.total_users}` : ''}
          change={stats.rank_change}
          changeType={stats.rank_change > 0 ? 'decrease' : stats.rank_change < 0 ? 'increase' : 'neutral'}
          icon={Users}
          color="purple"
          loading={loading}
        />
      </div>

      {/* 图表和快速操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart
            data={chartData}
            title={t('dashboard.activityTrend')}
            description={t('dashboard.activityTrendDesc')}
            dataKey="carbon_saved"
            xAxisKey="date"
            color="#10b981"
            loading={loading}
          />
        </div>
        
        <div>
          <QuickActions
            userStats={{
              points_balance: stats.total_points,
              unread_messages: stats.unread_messages,
              pending_reviews: stats.pending_reviews,
              available_products: stats.available_products,
              new_achievements: stats.new_achievements
            }}
            onActionClick={handleQuickAction}
          />
        </div>
      </div>

      {/* 最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivities
          activities={recentActivities}
          loading={loading}
          onViewAll={handleViewAllActivities}
        />
        
        {/* 成就和排行榜 */}
        <div className="space-y-6">
          {/* 本月成就 */}
          {stats.monthly_achievements && stats.monthly_achievements.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5" />
                {t('dashboard.monthlyAchievements')}
              </h3>
              <div className="space-y-2">
                {stats.monthly_achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-yellow-700">{achievement.name}</span>
                    <span className="text-yellow-600">+{achievement.points} {t('dashboard.points')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 排行榜预览 */}
          {stats.leaderboard && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('dashboard.leaderboard')}
              </h3>
              <div className="space-y-3">
                {stats.leaderboard.slice(0, 5).map((user, index) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="flex-1 text-sm text-blue-700">
                      {user.username}
                    </span>
                    <span className="text-sm text-blue-600">
                      {user.total_points} {t('dashboard.points')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
