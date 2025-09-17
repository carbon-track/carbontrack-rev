import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { useTranslation } from '../../hooks/useTranslation';

export function ActivityChart({ 
  data = [], 
  type = 'line', 
  title, 
  description,
  dataKey = 'value',
  xAxisKey = 'date',
  color = '#10b981',
  loading = false 
}) {
  const { t } = useTranslation();

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
          <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  const formatTooltipValue = (value, name) => {
    if (name === 'carbon_saved') {
      return [`${value} kg CO₂`, t('activities.carbonSaved')];
    }
    if (name === 'points') {
      return [`${value} ${t('dashboard.points')}`, t('dashboard.points')];
    }
    if (name === 'activities') {
      return [`${value} ${t('dashboard.activities')}`, t('dashboard.activities')];
    }
    return [value, name];
  };

  const formatXAxisLabel = (value) => {
    // 如果是日期格式，进行格式化
    if (typeof value === 'string' && value.includes('-')) {
      const date = new Date(value);
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
    return value;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>{t('dashboard.noDataAvailable')}</p>
              <p className="text-sm mt-1">{t('dashboard.startRecordingActivities')}</p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey={xAxisKey}
                    tickFormatter={formatXAxisLabel}
                    stroke="#666"
                    fontSize={12}
                  />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelStyle={{ color: '#666' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={dataKey} 
                    stroke={color} 
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey={xAxisKey}
                    tickFormatter={formatXAxisLabel}
                    stroke="#666"
                    fontSize={12}
                  />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelStyle={{ color: '#666' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey={dataKey} 
                    fill={color}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

