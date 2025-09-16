import React from 'react';
import { Search, Filter, X, Package, Star } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function StoreFilters({ 
  filters, 
  onFiltersChange, 
  categories = [], 
  isLoading = false 
}) {
  const { t } = useTranslation();

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // 重置到第一页
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      min_points: '',
      max_points: '',
      sort: 'created_at',
      page: 1
    });
  };

  const hasActiveFilters = filters.search || filters.category || filters.min_points || filters.max_points;

  const sortOptions = [
    { value: 'created_at', label: t('store.filters.sort.newest') },
    { value: 'points_asc', label: t('store.filters.sort.pointsLowToHigh') },
    { value: 'points_desc', label: t('store.filters.sort.pointsHighToLow') },
    { value: 'popular', label: t('store.filters.sort.popular') },
    { value: 'name', label: t('store.filters.sort.name') }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">{t('store.filters.title')}</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            {t('store.filters.clear')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('store.filters.search')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('store.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 分类筛选 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('store.filters.category')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          >
            <option value="">{t('store.filters.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.category} value={category.category}>
                {t(`store.categories.${category.category}`, category.category)} 
                ({category.product_count})
              </option>
            ))}
          </select>
        </div>

        {/* 排序 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('store.filters.sortBy')}
          </label>
          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 积分范围筛选 */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('store.filters.pointsRange')}
        </label>
        <div className="flex items-center space-x-3">
          <Input
            type="number"
            value={filters.min_points}
            onChange={(e) => handleFilterChange('min_points', e.target.value)}
            placeholder={t('store.filters.minPoints')}
            className="w-32"
            min="0"
          />
          <span className="text-gray-500">-</span>
          <Input
            type="number"
            value={filters.max_points}
            onChange={(e) => handleFilterChange('max_points', e.target.value)}
            placeholder={t('store.filters.maxPoints')}
            className="w-32"
            min="0"
          />
        </div>
      </div>

      {/* 快速筛选标签 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!filters.category ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange('category', '')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1" />
            {t('store.filters.allProducts')}
          </Button>
          
          {categories.slice(0, 5).map((category) => (
            <Button
              key={category.category}
              variant={filters.category === category.category ? "default" : "outline"}
              size="sm"
              onClick={() => handleFilterChange('category', category.category)}
              className="text-xs"
            >
              {t(`store.categories.${category.category}`, category.category)}
              <span className="ml-1 text-xs opacity-75">({category.product_count})</span>
            </Button>
          ))}

          <Button
            variant={filters.sort === 'popular' ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange('sort', 'popular')}
            className="text-xs"
          >
            <Star className="h-3 w-3 mr-1" />
            {t('store.filters.popular')}
          </Button>
        </div>
      </div>

      {/* 活动筛选结果提示 */}
      {hasActiveFilters && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <Filter className="h-4 w-4" />
              <span>{t('store.filters.activeFilters')}:</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t('store.filters.search')}: "{filters.search}"
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t(`store.categories.${filters.category}`, filters.category)}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.min_points || filters.max_points) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {filters.min_points || 0} - {filters.max_points || '∞'} {t('common.points')}
                <button
                  onClick={() => {
                    handleFilterChange('min_points', '');
                    handleFilterChange('max_points', '');
                  }}
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

