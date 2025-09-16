import React from 'react';
import { Search, Filter, X, Mail, MailOpen } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function MessageFilters({
  filters,
  onFiltersChange,
  isLoading = false
}) {
  const { t } = useTranslation();

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // Reset to first page on filter change
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: '',
      sort: 'created_at_desc',
      page: 1
    });
  };

  const hasActiveFilters = !!(filters.search || filters.status);

  const statusOptions = [
    { value: 'unread', label: t('messages.unread'), icon: <Mail className="h-4 w-4 text-blue-500" /> },
    { value: 'read', label: t('messages.read'), icon: <MailOpen className="h-4 w-4 text-gray-500" /> }
  ];

  // 后端无 type/priority 字段，移除相关选项

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">{t('messages.filters.title')}</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            {t('common.clear')}
          </Button>
        )}
      </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('messages.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 状态筛选 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('messages.filters.status')}
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          >
            <option value="">{t('messages.filters.allStatus')}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>


      {/* 排序 */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('common.sort.sortBy')}
        </label>
        <select
          value={filters.sort}
          onChange={(e) => handleFilterChange('sort', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isLoading}
        >
          <option value="created_at_desc">{t('common.sort.newest')}</option>
          <option value="created_at_asc">{t('common.sort.oldest')}</option>
          <option value="priority_desc">{t('messages.filters.priorityHighToLow')}</option>
          <option value="priority_asc">{t('messages.filters.priorityLowToHigh')}</option>
        </select>
      </div>

      {/* 活动筛选结果提示 */}
      {hasActiveFilters && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <Filter className="h-4 w-4" />
              <span>{t('messages.filters.activeFilters')}:</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t('common.search')}: "{filters.search}"
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t(`messages.${filters.status}`)}
                <button
                  onClick={() => handleFilterChange('status', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

