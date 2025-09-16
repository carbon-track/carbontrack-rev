import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { Loader2, Edit, Trash2, CheckCircle, XCircle, Search, PlusCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { Pagination } from '../ui/Pagination';
import { toast } from 'react-hot-toast';

export function UserManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    role: '', // 使用后端支持的 role 过滤（admin|user）
    status: '',
    page: 1,
    limit: 10,
    sort: 'created_at_desc'
  });
  const filterParams = { ...filters };
  const { data, isLoading, error, isFetching } = useQuery(
    ['adminUsers', filterParams],
    () => adminAPI.getUsers(filterParams),
    { keepPreviousData: true }
  );

  const updateUserMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.updateSuccess'));
      },
      onError: (err) => {
        toast.error(t('admin.users.updateFailed'));
        console.error('User update failed:', err);
      }
    }
  );

  const deleteUserMutation = useMutation(
    (id) => adminAPI.deleteUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.deleteSuccess'));
      },
      onError: (err) => {
        toast.error(t('admin.users.deleteFailed'));
        console.error('User delete failed:', err);
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleEditUser = (user) => {
    // 简化处理：弹窗切换是否为管理员
    const makeAdmin = window.confirm(t('admin.users.confirmToggleAdmin', { username: user.username }));
    updateUserMutation.mutate({ id: user.id, data: { is_admin: !!makeAdmin } });
  };

  const handleDeleteUser = (user) => {
    if (window.confirm(t('admin.users.confirmDelete', { username: user.username }))) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleToggleStatus = (user) => {
    const toActive = user.status !== 'active';
    if (window.confirm(t('admin.users.confirmToggleStatus', { username: user.username, to: toActive ? t('admin.users.statusActive') : t('admin.users.statusInactive') }))) {
      updateUserMutation.mutate({ id: user.id, data: { status: toActive ? 'active' : 'inactive' } });
    }
  };

  const handleAdjustPoints = (user) => {
    const deltaStr = window.prompt(t('admin.users.promptAdjustPoints', { username: user.username }));
    if (deltaStr === null) return;
    const delta = Number(deltaStr);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error(t('admin.users.invalidDelta'));
      return;
    }
    const reason = window.prompt(t('admin.users.promptAdjustReason')) || '';
    adminAPI.adjustUserPoints(user.id, { delta, reason })
      .then(() => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.adjustSuccess'));
      })
      .catch((err) => {
        console.error(err);
        toast.error(t('admin.users.adjustFailed'));
      });
  };

  // 后端返回结构：{ success, data: { users: [...], pagination: {...} } }
  const users = data?.data?.data?.users || [];
  const pagination = data?.data?.data?.pagination || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('admin.users.title')}</h2>
      <p className="text-muted-foreground">{t('admin.users.description')}</p>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder={t('admin.users.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.users.role')}</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              <option value="user">{t('admin.users.roleUser')}</option>
              <option value="admin">{t('admin.users.roleAdmin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.users.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              <option value="active">{t('admin.users.statusActive')}</option>
              <option value="inactive">{t('admin.users.statusInactive')}</option>
            </select>
          </div>
        </div>
      </div>

      {(() => {
        if (isLoading || isFetching) {
          return (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
          );
        }
        if (error) {
          return (
            <Alert variant="destructive">
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
            </Alert>
          );
        }
        if (users.length === 0) {
          return (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold">{t('admin.users.noUsersFound')}</h3>
              <p className="text-muted-foreground mt-2">{t('admin.users.tryDifferentFilters')}</p>
            </div>
          );
        }
        return (
          <>
            <div className="overflow-x-auto bg-white rounded-lg shadow-sm border">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.username')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.email')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.role')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.points')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.is_admin ? t('admin.users.roleAdmin') : t('admin.users.roleUser')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> {t('admin.users.statusActive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" /> {t('admin.users.statusInactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.points}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)} className="mr-2">
                        {user.status === 'active' ? t('admin.users.disable') : t('admin.users.enable')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAdjustPoints(user)} className="mr-2" title={t('admin.users.promptAdjustPoints', { username: user.username })}>
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} className="mr-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.total_pages}
              onPageChange={handlePageChange}
              itemsPerPage={pagination.per_page}
              totalItems={pagination.total_items}
            />
          </>
        );
      })()}
    </div>
  );
}

