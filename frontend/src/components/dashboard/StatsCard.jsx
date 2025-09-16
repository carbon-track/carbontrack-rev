import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export function StatsCard({ 
  title, 
  value, 
  unit = '', 
  change = null, 
  changeType = 'neutral',
  icon: Icon,
  color = 'blue',
  loading = false 
}) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      value: 'text-blue-900'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      value: 'text-green-900'
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-600',
      value: 'text-orange-900'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      value: 'text-purple-900'
    }
  };

  const changeIcons = {
    increase: TrendingUp,
    decrease: TrendingDown,
    neutral: Minus
  };

  const changeColors = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-gray-600'
  };

  const ChangeIcon = changeIcons[changeType];
  const classes = colorClasses[color];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-8 w-8 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          {Icon && (
            <div className={`p-2 rounded-lg ${classes.bg}`}>
              <Icon className={`h-5 w-5 ${classes.icon}`} />
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${classes.value}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {unit && (
              <span className="text-sm text-gray-500">{unit}</span>
            )}
          </div>
          
          {change !== null && (
            <div className={`flex items-center gap-1 text-sm ${changeColors[changeType]}`}>
              <ChangeIcon className="h-4 w-4" />
              <span>
                {typeof change === 'number' ? 
                  `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : 
                  change
                }
              </span>
              <span className="text-gray-500 ml-1">vs 上月</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

