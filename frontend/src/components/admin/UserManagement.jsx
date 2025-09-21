import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import {
  Loader2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  PlusCircle,
  Sparkles,
  Shield,
  Ban,
  Users as UsersIcon,
  Eye,
  Leaf,
  ClipboardList,
  CalendarDays,
  Award,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { Pagination } from '../ui/Pagination';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import BadgeBulkAwardDialog from './badges/BadgeBulkAwardDialog';
import { toast } from 'react-hot-toast';

const DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

const normalizeUser = (user = {}) => {
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    ...user,
    is_admin: user.is_admin === true || user.is_admin === 1 || user.is_admin === '1',
    points: toNumber(user.points),
    total_transactions: toNumber(user.total_transactions),
    earned_points: toNumber(user.earned_points),
    total_carbon_saved: toNumber(user.total_carbon_saved),
    badges_awarded: toNumber(user.badges_awarded),
    badges_revoked: toNumber(user.badges_revoked),
    active_badges: toNumber(user.active_badges),
    days_since_registration: toNumber(user.days_since_registration),
  };
};

function normalizeUsersResponse(response) {
  const payload = response?.data?.data || response?.data || {};
  if (Array.isArray(payload.users)) {
    return {
      users: payload.users.map(normalizeUser),
      pagination: payload.pagination || {},
    };
  }
  const nested = payload.data || {};
  const users = Array.isArray(nested.users) ? nested.users.map(normalizeUser) : [];
  return {
    users,
    pagination: nested.pagination || {},
  };
}

export function UserManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, user: null, payload: null });
  const [pointsDialog, setPointsDialog] = useState({ open: false, user: null, delta: '', reason: '' });
  const [selectedUsersMap, setSelectedUsersMap] = useState(new Map());
  const [bulkDialog, setBulkDialog] = useState({ open: false, presetUsers: [] });

  const apiFilterParams = useMemo(() => {
    const base = {
      page: filters.page,
      limit: filters.limit,
      sort: filters.sort,
    };
    const trimmedSearch = filters.search.trim();
    if (trimmedSearch) {
      base.q = trimmedSearch;
    }
    if (filters.status) {
      base.status = filters.status;
    }
    if (filters.role === 'admin') {
      base.is_admin = 1;
    } else if (filters.role === 'user') {
      base.is_admin = 0;
    }
    return base;
  }, [filters]);

  const usersQuery = useQuery(
    ['adminUsers', apiFilterParams],
    () => adminAPI.getUsers(apiFilterParams),
    { keepPreviousData: true }
  );

  const badgesQuery = useQuery(
    ['adminBadges', 'forAwarding'],
    () => adminAPI.getBadges({ limit: 200 }),
    { staleTime: 60000 }
  );

  const updateUserMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.updateSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.updateFailed'));
      },
    }
  );

  const deleteUserMutation = useMutation(
    (id) => adminAPI.deleteUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.deleteSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.deleteFailed'));
      },
    }
  );

  const adjustPointsMutation = useMutation(
    ({ id, data }) => adminAPI.adjustUserPoints(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.adjustSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.adjustFailed'));
      },
    }
  );

  useEffect(() => {
    if (searchParams.get('focus') === 'search' && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { users, pagination } = useMemo(() => normalizeUsersResponse(usersQuery.data), [usersQuery.data]);
  const selectedUsers = useMemo(() => Array.from(selectedUsersMap.values()), [selectedUsersMap]);
  const badgeOptions = useMemo(() => {
    const source = badgesQuery.data?.data?.data || badgesQuery.data?.data || [];
    return Array.isArray(source) ? source : [];
  }, [badgesQuery.data]);

  const allSelectedOnPage = users.length > 0 && users.every((user) => selectedUsersMap.has(user.id));
  const partiallySelected = users.some((user) => selectedUsersMap.has(user.id)) && !allSelectedOnPage;

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const handlePageChange = (page) => {
    handleFilterChange('page', page);
  };

  const toggleUserSelection = (user, shouldSelect) => {
    setSelectedUsersMap((prev) => {
      const next = new Map(prev);
      if (shouldSelect) {
        next.set(user.id, user);
      } else {
        next.delete(user.id);
      }
      return next;
    });
  };

  const handleSelectAllOnPage = (shouldSelect) => {
    setSelectedUsersMap((prev) => {
      const next = new Map(prev);
      if (shouldSelect) {
        users.forEach((user) => next.set(user.id, user));
      } else {
        users.forEach((user) => next.delete(user.id));
      }
      return next;
    });
  };

  const handleToggleStatus = (user) => {
    const toActive = user.status !== 'active';
    openConfirmDialog({
      type: 'status',
      user,
      payload: { nextStatus: toActive ? 'active' : 'inactive' },
    });
  };

  const handleEditUser = (user) => {
    const makeAdmin = !user.is_admin;
    openConfirmDialog({
      type: 'role',
      user,
      payload: { makeAdmin },
    });
  };

  const handleDeleteUser = (user) => {
    openConfirmDialog({ type: 'delete', user, payload: null });
  };

  const openConfirmDialog = (config) => {
    setConfirmDialog({ open: true, ...config });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: null, user: null, payload: null });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) {
      closeConfirmDialog();
      return;
    }
    if (confirmDialog.type === 'status') {
      const nextStatus = confirmDialog.payload.nextStatus;
      updateUserMutation.mutate(
        { id: confirmDialog.user.id, data: { status: nextStatus } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'role') {
      const makeAdmin = confirmDialog.payload.makeAdmin;
      updateUserMutation.mutate(
        { id: confirmDialog.user.id, data: { is_admin: makeAdmin } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'delete') {
      deleteUserMutation.mutate(confirmDialog.user.id, { onSettled: closeConfirmDialog });
    } else {
      closeConfirmDialog();
    }
  };

  const openAdjustPoints = (user) => {
    setPointsDialog({ open: true, user, delta: '', reason: '' });
  };

  const closeAdjustPoints = () => {
    setPointsDialog({ open: false, user: null, delta: '', reason: '' });
  };

  const handleSubmitAdjustPoints = () => {
    if (!pointsDialog.user) return;
    const deltaValue = Number(pointsDialog.delta);
    if (!Number.isFinite(deltaValue) || deltaValue === 0) {
      toast.error(t('admin.users.invalidDelta'));
      return;
    }
    adjustPointsMutation.mutate(
      { id: pointsDialog.user.id, data: { delta: deltaValue, reason: pointsDialog.reason } },
      { onSettled: closeAdjustPoints }
    );
  };

  const openBulkBadgeDialog = (usersList) => {
    if (!usersList || usersList.length === 0) {
      toast.error(t('admin.users.selectUserHint', '请先选择用户'));
      return;
    }
    setBulkDialog({ open: true, presetUsers: usersList });
  };

  const clearSelection = () => {
    setSelectedUsersMap(new Map());
  };

  const renderStatusBadge = (user) => (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
      {user.status === 'active' ? (
        <span className="bg-green-100 text-green-800 flex items-center gap-1 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" />
          {t('admin.users.statusActive')}
        </span>
      ) : (
        <span className="bg-red-100 text-red-800 flex items-center gap-1 px-2 py-0.5 rounded-full">
          <XCircle className="h-3 w-3" />
          {t('admin.users.statusInactive')}
        </span>
      )}
    </span>
  );

  const renderRoleBadge = (user) => (
    <Badge variant={user.is_admin ? 'default' : 'outline'}>
      {user.is_admin ? t('admin.users.roleAdmin') : t('admin.users.roleUser')}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('admin.users.title')}</h2>
        <p className="text-muted-foreground">{t('admin.users.description')}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
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

        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/60 p-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t('admin.users.selectedCount', '已选择 {{count}} 位用户', { count: selectedUsers.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openBulkBadgeDialog(selectedUsers)}
                disabled={badgesQuery.isLoading || badgeOptions.length === 0}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('admin.users.bulkAwardBadges', '批量授予徽章')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t('common.clear', '清空')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {(() => {
        if (usersQuery.isLoading || usersQuery.isFetching) {
          return (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
          );
        }
        if (usersQuery.error) {
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
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={allSelectedOnPage ? true : partiallySelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => handleSelectAllOnPage(checked === true || checked === 'indeterminate')}
                        aria-label={t('admin.users.selectAll', '选择当前页所有用户')}
                        className="translate-y-0.5"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.username')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.email')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.role')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.points')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const isSelected = selectedUsersMap.has(user.id);
                    return (
                      <tr key={user.id} className={isSelected ? 'bg-emerald-50/40' : ''}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleUserSelection(user, checked === true || checked === 'indeterminate')}
                            aria-label={t('admin.users.selectUser', '选择用户 {{username}}', { username: user.username })}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderRoleBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderStatusBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.points}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)} title={t('admin.users.toggleStatusButton', '切换用户状态')}>
                            <Ban className="h-4 w-4 mr-1" />
                            {user.status === 'active' ? t('admin.users.disable') : t('admin.users.enable')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAdjustPoints(user)} title={t('admin.users.promptAdjustPoints', { username: user.username })}>
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title={t('admin.users.toggleAdminButton', '切换管理员权限')}>
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openBulkBadgeDialog([user])} title={t('admin.users.awardBadgeButton', '授予徽章')} disabled={badgeOptions.length === 0}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-800" title={t('admin.users.deleteButton', '删除用户')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => (!open ? closeConfirmDialog() : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'status' && t('admin.users.confirmToggleStatusTitle', '确认修改状态')}
              {confirmDialog.type === 'role' && t('admin.users.confirmToggleAdminTitle', '确认切换角色')}
              {confirmDialog.type === 'delete' && t('admin.users.confirmDeleteTitle', '确认删除用户')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'status' && confirmDialog.user && (
                t('admin.users.confirmToggleStatus', {
                  username: confirmDialog.user.username,
                  to: confirmDialog.payload.nextStatus === 'active'
                    ? t('admin.users.statusActive')
                    : t('admin.users.statusInactive'),
                })
              )}
              {confirmDialog.type === 'role' && confirmDialog.user && (
                t('admin.users.confirmToggleAdmin', { username: confirmDialog.user.username })
              )}
              {confirmDialog.type === 'delete' && confirmDialog.user && (
                t('admin.users.confirmDelete', { username: confirmDialog.user.username })
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirmDialog}>{t('common.cancel', '取消')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>{t('common.confirm', '确认')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pointsDialog.open} onOpenChange={(open) => (!open ? closeAdjustPoints() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.users.adjustPointsTitle', '调整积分')}</DialogTitle>
            <DialogDescription>
              {pointsDialog.user ? t('admin.users.adjustPointsDescription', { username: pointsDialog.user.username }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="points-delta">{t('admin.users.adjustPointsDelta', '积分变动值')}</Label>
              <Input
                id="points-delta"
                type="number"
                value={pointsDialog.delta}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, delta: e.target.value }))}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.users.adjustPointsHint', '输入正数表示增加积分，负数表示扣减积分')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-reason">{t('admin.users.adjustPointsReason', '调整说明')}</Label>
              <Textarea
                id="points-reason"
                rows={3}
                value={pointsDialog.reason}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={t('admin.users.adjustPointsReasonPlaceholder', '请输入调整原因，便于审计记录')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdjustPoints}>{t('common.cancel', '取消')}</Button>
            <Button onClick={handleSubmitAdjustPoints} disabled={adjustPointsMutation.isLoading}>
              {adjustPointsMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm', '确认')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BadgeBulkAwardDialog
        open={bulkDialog.open}
        onOpenChange={(open) => (!open ? setBulkDialog({ open: false, presetUsers: [] }) : null)}
        badges={badgeOptions}
        defaultSelectedBadgeIds={[]}
        presetUsers={bulkDialog.presetUsers}
        onCompleted={() => {
          setBulkDialog({ open: false, presetUsers: [] });
          queryClient.invalidateQueries('adminUsers');
        }}
        mode="award"
      />
    </div>
  );
}
