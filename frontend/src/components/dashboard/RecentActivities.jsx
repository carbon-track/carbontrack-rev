import React, { useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../lib/utils';
import { ActivityDetailModal } from '../activities/ActivityDetailModal';

export function RecentActivities({ activities = [], loading = false, onViewAll }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);


  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      default:
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'pending':
      default:
        return 'text-orange-600 bg-orange-50';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return t('date.today');
    } else if (diffDays === 2) {
      return t('date.yesterday');
    } else if (diffDays <= 7) {
      return `${diffDays - 1} ${t('date.daysAgo')}`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getActivityName = (activity) => {
    return activity.activity_name_zh || activity.activity_name_en || activity.activity_name || t('activities.unknownActivity');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('dashboard.recentActivities')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.recentActivitiesDesc')}
            </CardDescription>
          </div>
          {activities.length > 0 && (
            <Button variant="outline" size="sm" onClick={onViewAll}>
              <Eye className="h-4 w-4 mr-1" />
              {t('dashboard.viewAll')}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🌱</div>
            <p className="text-gray-600 mb-2">{t('dashboard.noRecentActivities')}</p>
            <p className="text-sm text-gray-500">{t('dashboard.startRecordingHint')}</p>
            <Button className="mt-4" onClick={() => window.location.href = '/calculate'}>
              {t('dashboard.recordFirstActivity')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    {getStatusIcon(activity.status)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {getActivityName(activity)}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {t(`activities.status.${activity.status}`)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatDate(activity.created_at)}</span>
                    <span>{activity.data} {activity.unit}</span>
                    {(() => {
                      const formatted = formatNumber(activity.carbon_saved, 2);
                      return formatted !== null ? (
                        <span className="text-green-600">
                          {formatted} kg CO₂
                        </span>
                      ) : null;
                    })()}
                    {activity.points_earned && activity.status === 'approved' && (
                      <span className="text-blue-600">
                        +{activity.points_earned} {t('dashboard.points')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => { setSelected(activity); setOpen(true); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {activities.length > 5 && (
              <div className="text-center pt-4 border-t">
                <Button variant="outline" onClick={onViewAll}>
                  {t('dashboard.viewAllActivities', { count: activities.length })}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <ActivityDetailModal
        activity={selected}
        isOpen={open}
        onClose={() => { setOpen(false); setSelected(null); }}
      />
    </Card>
  );
}

