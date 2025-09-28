import React, { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery } from 'react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Pagination } from '../ui/Pagination';
import { cn } from '../../lib/utils';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const INITIAL_FORM = {
  title: '',
  content: '',
  priority: 'normal',
  scope: 'all',
  target_users_text: ''
};
const MAX_USERS_PREVIEW = 20;
const HISTORY_DEFAULT_PARAMS = { page: 1, limit: 20 };
const FILTERS_DEFAULT = {
  search: '',
  priority: 'any',
  scope: 'any',
  unreadOnly: false,
};

const RECIPIENT_SEARCH_DEFAULT = {
  search: '',
  fields: 'username,email,school,location',
  school: '',
  emailSuffix: '',
  status: 'any',
  isAdmin: 'any',
  limit: 25,
};

const parseTargetUserIds = (raw) => {
  if (!raw) {
    return [];
  }
  const tokens = raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = new Set();
  tokens.forEach((token) => {
    const numeric = Number(token);
    if (Number.isInteger(numeric) && numeric > 0) {
      unique.add(numeric);
    }
  });
  return Array.from(unique);
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const truncateUsers = (users, max = MAX_USERS_PREVIEW) => {
  if (!Array.isArray(users)) {
    return { list: [], more: 0 };
  }
  if (users.length <= max) {
    return { list: users, more: 0 };
  }
  return { list: users.slice(0, max), more: users.length - max };
};

function ResultStat({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold',
          tone === 'success' && 'text-green-600',
          tone === 'warning' && 'text-yellow-600',
          tone === 'danger' && 'text-red-600'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function UserChips({ users }) {
  if (!users || users.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <Badge key={`${user.message_id ?? user.user_id ?? Math.random()}`} variant="outline" className="font-normal">
          {user.username ?? `#${user.user_id ?? '?'}`}
        </Badge>
      ))}
    </div>
  );
}

export function BroadcastCenter() {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [expanded, setExpanded] = useState({});
  const [historyParams, setHistoryParams] = useState(HISTORY_DEFAULT_PARAMS);
  const [filters, setFilters] = useState(FILTERS_DEFAULT);
  const [recipientForm, setRecipientForm] = useState(RECIPIENT_SEARCH_DEFAULT);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientResults, setRecipientResults] = useState({ items: [], pagination: { page: 1, has_more: false, limit: RECIPIENT_SEARCH_DEFAULT.limit } });
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState(null);
  const [selectedRecipients, setSelectedRecipients] = useState(() => new Map());
  const [appliedFilters, setAppliedFilters] = useState([]);

  const hasRecipientCriteria = useMemo(() => {
    return Boolean(
      recipientForm.search.trim() ||
        recipientForm.school.trim() ||
        recipientForm.emailSuffix.trim() ||
        (recipientForm.status && recipientForm.status !== 'any') ||
        (recipientForm.isAdmin && recipientForm.isAdmin !== 'any')
    );
  }, [recipientForm]);

  const customTargetIds = useMemo(() => {
    if (form.scope !== 'custom') {
      return [];
    }
    return parseTargetUserIds(form.target_users_text);
  }, [form.scope, form.target_users_text]);

  const selectedRecipientList = useMemo(() => Array.from(selectedRecipients.values()), [selectedRecipients]);
  const selectedRecipientIds = useMemo(
    () => selectedRecipientList.map((entry) => Number(entry?.id ?? 0)).filter((id) => Number.isInteger(id) && id > 0),
    [selectedRecipientList]
  );

  const {
    data: historyResponse,
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery(
    ['admin-broadcast-history', historyParams],
    () => adminAPI.getBroadcasts(historyParams).then((res) => res.data),
    {
      keepPreviousData: true,
      staleTime: 60000,
    }
  );

  const historyItems = historyResponse?.data ?? [];
  const pagination = historyResponse?.pagination ?? {};

  const filteredItems = useMemo(() => {
    if (!Array.isArray(historyItems)) {
      return [];
    }
    const search = filters.search.trim().toLowerCase();
    return historyItems.filter((item) => {
      if (filters.priority !== 'any' && item.priority !== filters.priority) {
        return false;
      }
      if (filters.scope !== 'any') {
        const scopeKey = item.scope === 'custom' ? 'custom' : 'all';
        if (scopeKey !== filters.scope) {
          return false;
        }
      }
      if (filters.unreadOnly && (item.unread_count ?? 0) === 0) {
        return false;
      }
      if (!search) {
        return true;
      }
      const pooled = [item.title, item.content, item.actor_username, item.actor_user_id && `#${item.actor_user_id}`]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return pooled.some((value) => value.includes(search));
    });
  }, [historyItems, filters]);

  const summary = useMemo(() => {
    const totals = {
      broadcasts: filteredItems.length,
      targets: 0,
      sent: 0,
      read: 0,
      unread: 0,
    };
    filteredItems.forEach((item) => {
      totals.targets += item.target_count ?? 0;
      totals.sent += item.sent_count ?? 0;
      totals.read += item.read_count ?? 0;
      totals.unread += item.unread_count ?? 0;
    });
    return totals;
  }, [filteredItems]);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'target_users_text' && typeof value === 'string' && value.trim().length > 0) {
        next.scope = 'custom';
      }
      return next;
    });
  };

  const updateFilters = (partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setHistoryParams((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFilters(FILTERS_DEFAULT);
    setHistoryParams((prev) => ({ ...prev, page: 1 }));
  };

  const setRecipientField = (key, value) => {
    setRecipientForm((prev) => ({ ...prev, [key]: value }));
  };

  const ensureCustomScope = useCallback(() => {
    setForm((prev) => (prev.scope === 'custom' ? prev : { ...prev, scope: 'custom' }));
  }, [setForm]);

  const buildRecipientParams = useCallback(
    (overrides = {}) => {
      const params = {};
      const search = recipientForm.search.trim();
      if (search) {
        params.search = search;
      }
      const fields = recipientForm.fields.trim();
      if (fields) {
        params.fields = fields;
      }
      const school = recipientForm.school.trim();
      if (school) {
        params.school = school;
      }
      const emailSuffix = recipientForm.emailSuffix.trim();
      if (emailSuffix) {
        params.email_suffix = emailSuffix;
      }
      if (recipientForm.status && recipientForm.status !== 'any') {
        params.status = recipientForm.status;
      }
      if (recipientForm.isAdmin && recipientForm.isAdmin !== 'any') {
        params.is_admin = recipientForm.isAdmin;
      }
      const limitRaw = overrides.limit ?? recipientForm.limit ?? 25;
      const limit = Math.max(10, Math.min(500, Number(limitRaw) || 25));
      params.limit = limit;
      const pageRaw = overrides.page ?? 1;
      params.page = Math.max(1, Number(pageRaw) || 1);
      return params;
    },
    [recipientForm]
  );

  const buildFilterPayload = useCallback(() => {
    const payload = {};
    const search = recipientForm.search.trim();
    const school = recipientForm.school.trim();
    const emailSuffix = recipientForm.emailSuffix.trim();
    const limit = Math.max(10, Math.min(500, Number(recipientForm.limit) || 25));

    payload.limit = limit;

    if (search) {
      payload.search = search;
      if (recipientForm.fields && recipientForm.fields !== RECIPIENT_SEARCH_DEFAULT.fields) {
        payload.fields = recipientForm.fields;
      }
    }
    if (school) {
      payload.school = school;
    }
    if (emailSuffix) {
      payload.email_suffix = emailSuffix;
    }
    if (recipientForm.status && recipientForm.status !== 'any') {
      payload.status = recipientForm.status;
    }
    if (recipientForm.isAdmin && recipientForm.isAdmin !== 'any') {
      payload.is_admin = recipientForm.isAdmin;
    }
    return payload;
  }, [recipientForm]);

  const describeFilter = useCallback(
    (filter) => {
      if (!filter || typeof filter !== 'object') {
        return t('admin.broadcast.recipientFilters.summary.fallback', 'Custom filter');
      }

      const parts = [];
      if (filter.search) {
        parts.push(t('admin.broadcast.recipientFilters.summary.search', { value: filter.search }));
        if (filter.fields) {
          const labels = filter.fields
            .split(',')
            .map((field) => field.trim())
            .filter(Boolean)
            .map((field) => {
              const normalized = field === 'school_name' ? 'school' : field;
              return t('admin.broadcast.recipientSearch.fields.' + normalized, normalized.replace(/_/g, ' '));
            });
          if (labels.length > 0) {
            parts.push(t('admin.broadcast.recipientFilters.summary.fields', { fields: labels.join(', ') }));
          }
        }
      }
      if (filter.school) {
        parts.push(t('admin.broadcast.recipientFilters.summary.school', { value: filter.school }));
      }
      if (filter.email_suffix) {
        parts.push(t('admin.broadcast.recipientFilters.summary.emailSuffix', { value: filter.email_suffix }));
      }
      if (filter.status === 'active' || filter.status === 'inactive') {
        parts.push(t('admin.broadcast.recipientFilters.summary.status.' + filter.status, filter.status));
      }
      if (
        filter.is_admin === '1' ||
        filter.is_admin === 1 ||
        filter.is_admin === true ||
        filter.is_admin === 'true'
      ) {
        parts.push(t('admin.broadcast.recipientFilters.summary.role.admin'));
      } else if (
        filter.is_admin === '0' ||
        filter.is_admin === 0 ||
        filter.is_admin === false ||
        filter.is_admin === 'false'
      ) {
        parts.push(t('admin.broadcast.recipientFilters.summary.role.user'));
      }
      if (filter.limit) {
        parts.push(t('admin.broadcast.recipientFilters.summary.limit', { count: filter.limit }));
      }

      if (parts.length === 0) {
        return t('admin.broadcast.recipientFilters.summary.fallback', 'Custom filter');
      }

      const joiner = t('admin.broadcast.recipientFilters.summary.joiner', ' • ');
      return parts.join(joiner);
    },
    [t]
  );

  const loadRecipients = useCallback(
    async (overrides = {}) => {
      const params = buildRecipientParams(overrides);
      setRecipientLoading(true);
      setRecipientError(null);
      try {
        const res = await adminAPI.searchBroadcastRecipients(params);
        const payload = res?.data ?? {};
        const list = Array.isArray(payload.data) ? payload.data : [];
        const pagination = payload.pagination ?? {};
        const page = pagination.page ?? params.page ?? 1;
        const limit = pagination.limit ?? params.limit ?? recipientForm.limit ?? 25;
        const hasMore = Boolean(pagination.has_more);
        setRecipientResults({ items: list, pagination: { page, limit, has_more: hasMore } });
        setRecipientPage(page);
      } catch (error) {
        setRecipientError(error);
        setRecipientResults((prev) => ({ ...prev, items: [] }));
      } finally {
        setRecipientLoading(false);
      }
    },
    [buildRecipientParams, recipientForm.limit]
  );

  const handleRecipientSearch = async () => {
    await loadRecipients({ page: 1 });
  };

  const handleRecipientPageChange = (direction) => {
    if (direction === 'prev') {
      const prevPage = Math.max(1, recipientResults.pagination.page - 1);
      if (prevPage !== recipientResults.pagination.page) {
        loadRecipients({ page: prevPage });
      }
      return;
    }
    if (recipientResults.pagination.has_more) {
      loadRecipients({ page: recipientResults.pagination.page + 1 });
    }
  };

  const clearRecipientSearch = () => {
    setRecipientForm(RECIPIENT_SEARCH_DEFAULT);
    setRecipientResults({ items: [], pagination: { page: 1, has_more: false, limit: RECIPIENT_SEARCH_DEFAULT.limit } });
    setRecipientPage(1);
    setRecipientError(null);
  };

  const toggleRecipientSelection = useCallback(
    (recipient) => {
      if (!recipient || recipient.id === undefined || recipient.id === null) {
        return;
      }
      const id = Number(recipient.id);
      if (!Number.isInteger(id) || id <= 0) {
        return;
      }
      ensureCustomScope();
      setSelectedRecipients((prev) => {
        const next = new Map(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.set(id, {
            id,
            username: recipient.username ?? null,
            email: recipient.email ?? null,
            school: recipient.school ?? null,
          });
        }
        return next;
      });
    },
    [ensureCustomScope]
  );

  const removeSelectedRecipient = (id) => {
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const clearSelectedRecipients = () => {
    setSelectedRecipients(new Map());
  };

  const addAllRecipientsFromResults = () => {
    if (!recipientResults.items.length) {
      toast.error(t('admin.broadcast.recipients.emptySelection', 'No recipients in current result set.'));
      return;
    }
    ensureCustomScope();
    setSelectedRecipients((prev) => {
      const next = new Map(prev);
      recipientResults.items.forEach((item) => {
        const id = Number(item?.id ?? 0);
        if (Number.isInteger(id) && id > 0) {
          next.set(id, {
            id,
            username: item.username ?? null,
            email: item.email ?? null,
            school: item.school ?? null,
          });
        }
      });
      return next;
    });
    toast.success(t('admin.broadcast.recipients.addedAll', 'Recipients added to selection.'));
  };

  const addFilterGroup = () => {
    if (!hasRecipientCriteria) {
      toast.error(t('admin.broadcast.recipientFilters.requireCondition', 'Please configure at least one filter condition.'));
      return;
    }
    ensureCustomScope();
    const payload = buildFilterPayload();
    setAppliedFilters((prev) => [...prev, payload]);
    toast.success(t('admin.broadcast.recipientFilters.added', 'Filter added to broadcast payload.'));
  };

  const removeFilterGroup = (index) => {
    setAppliedFilters((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validateForm = () => {
    const addAnnouncementMarkers = (title) => {
      if (!title || typeof title !== 'string') return title;
      const trimmed = title.trim();
      const lower = trimmed.toLowerCase();
      // If title already contains announcement markers or keywords, don't add
      if (/(\[announcement\]|\[公告\]|【公告】|\b(公告|announcement|broadcast|boardcast|system|系统)\b)/i.test(lower)) {
        return trimmed;
      }
      // Prepend English and Chinese markers for clarity
      return `[Announcement/公告] ${trimmed}`;
    };

    const normalizedPriority = PRIORITIES.includes(form.priority) ? form.priority : 'normal';
    const payload = {
      title: addAnnouncementMarkers(form.title.trim()),
      content: form.content.trim(),
      priority: normalizedPriority
    };

    const nextErrors = {};

    if (!payload.title) {
      nextErrors.title = t('admin.broadcast.validation.titleRequired');
    }
    if (!payload.content) {
      nextErrors.content = t('admin.broadcast.validation.contentRequired');
    }
    if (!PRIORITIES.includes(form.priority)) {
      nextErrors.priority = t('admin.broadcast.validation.priorityInvalid');
    }

    if (form.scope === 'custom') {
      const manualInput = form.target_users_text.trim();
      const combinedIds = new Set(selectedRecipientIds);

      if (customTargetIds.length > 0) {
        customTargetIds.forEach((id) => combinedIds.add(id));
      } else if (manualInput.length > 0 && selectedRecipientIds.length === 0) {
        nextErrors.target_users_text = t('admin.broadcast.validation.targetsInvalid');
      }

      if (combinedIds.size > 0) {
        payload.target_users = Array.from(combinedIds);
      }

      if (combinedIds.size === 0 && appliedFilters.length === 0) {
        nextErrors.target_users_text = t('admin.broadcast.validation.targetsRequired');
      }

      if (appliedFilters.length > 0) {
        payload.target_filters = appliedFilters.map((filter) => ({ ...filter }));
      }
    }

    if (form.scope !== 'custom') {
      const combined = new Set();
      if (selectedRecipientIds.length > 0) {
        selectedRecipientIds.forEach((id) => combined.add(id));
      }
      if (customTargetIds.length > 0) {
        customTargetIds.forEach((id) => combined.add(id));
      }
      if (combined.size > 0) {
        payload.target_users = Array.from(combined);
      }
      if (appliedFilters.length > 0) {
        payload.target_filters = appliedFilters.map((filter) => ({ ...filter }));
      }
    }

    setErrors(nextErrors);
    const firstError = Object.values(nextErrors)[0];
    return { payload, isValid: Object.keys(nextErrors).length === 0, firstError };
  };

  const broadcastMutation = useMutation(
    (payload) => adminAPI.broadcastMessage(payload),
    {
      onSuccess: (res, variables) => {
        const data = res?.data ?? {};
        const failedIds = Array.isArray(data.failed_user_ids) ? data.failed_user_ids : [];
        const invalidIds = Array.isArray(data.invalid_user_ids) ? data.invalid_user_ids : [];
        const summaryPayload = {
          sent: data.sent_count ?? 0,
          total: data.total_targets ?? (variables?.target_users ? variables.target_users.length : 0),
          failed: failedIds,
          invalid: invalidIds,
          priority: data.priority ?? variables?.priority ?? 'normal',
          emailDelivery: data.email_delivery ?? null,
        };

        toast.success(t('admin.broadcast.sendSuccess', { count: summaryPayload.sent }));
        setPreview(null);
        setForm(INITIAL_FORM);
        setErrors({});
        setResult(summaryPayload);
        setExpanded({});
        setSelectedRecipients(new Map());
        setAppliedFilters([]);
        refetchHistory();
      },
      onError: (error) => {
        const message = error?.response?.data?.error || error?.message || t('admin.broadcast.sendFailed');
        toast.error(message);
      }
    }
  );

  const handlePreview = () => {
    const { payload, isValid, firstError } = validateForm();
    if (!isValid) {
      toast.error(firstError ?? t('admin.broadcast.validation.general'));
      return;
    }

    setPreview({
      title: payload.title,
      content: payload.content,
      priority: payload.priority,
      scope: form.scope,
      targetCount: form.scope === 'custom' ? (payload.target_users?.length ?? 0) : null
    });
  };

  const handleSend = () => {
    const { payload, isValid, firstError } = validateForm();
    if (!isValid) {
      toast.error(firstError ?? t('admin.broadcast.validation.general'));
      return;
    }
    setResult(null);
    broadcastMutation.mutate(payload);
  };

  const toggleDetails = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = () => {
    if (!filteredItems.length) {
      toast.error(t('admin.broadcast.export.empty'));
      return;
    }
    try {
      const headers = [
        'id',
        'title',
        'content',
        'priority',
        'scope',
        'targets',
        'sent',
        'read',
        'unread',
        'failed',
        'invalid',
        'actor',
        'created_at',
        'read_users',
        'unread_users',
      ];
      const escapeCsv = (value) => {
        if (value === null || value === undefined) {
          return '""';
        }
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      };
      const rows = filteredItems.map((item) => {
        const actorLabel = item.actor_username || (item.actor_user_id ? `#${item.actor_user_id}` : t('common.unknown'));
        const readUsers = Array.isArray(item.read_users)
          ? item.read_users.map((user) => user.username || `#${user.user_id ?? '?'}`).join('; ')
          : '';
        const unreadUsers = Array.isArray(item.unread_users)
          ? item.unread_users.map((user) => user.username || `#${user.user_id ?? '?'}`).join('; ')
          : '';
        return [
          item.id,
          item.title,
          item.content,
          item.priority,
          item.scope,
          item.target_count,
          item.sent_count,
          item.read_count,
          item.unread_count,
          Array.isArray(item.failed_user_ids) ? item.failed_user_ids.join(' ') : '',
          Array.isArray(item.invalid_user_ids) ? item.invalid_user_ids.join(' ') : '',
          actorLabel,
          item.created_at,
          readUsers,
          unreadUsers,
        ].map(escapeCsv).join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `broadcast-history-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('admin.broadcast.export.success'));
    } catch (error) {
      toast.error(t('admin.broadcast.export.error'));
    }
  };

  const handlePageChange = (page) => {
    setExpanded({});
    setHistoryParams((prev) => ({ ...prev, page }));
  };

  const isSubmitting = broadcastMutation.isLoading;
  const invalidCount = result?.invalid?.length ?? 0;
  const failedCount = result?.failed?.length ?? 0;
  const exportDisabled = filteredItems.length === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('admin.broadcast.title')}</h2>
      <p className="text-muted-foreground">{t('admin.broadcast.description')}</p>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        {Object.keys(errors).length > 0 && (
          <Alert variant="warning">
            <AlertTitle>{t('admin.broadcast.validation.general')}</AlertTitle>
          </Alert>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.title')}</label>
          <Input
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            error={Boolean(errors.title)}
            placeholder={t('admin.broadcast.form.title')}
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.content')}</label>
          <Textarea
            value={form.content}
            onChange={(event) => setField('content', event.target.value)}
            className={cn(errors.content && 'border-red-500 focus-visible:ring-red-500')}
            placeholder={t('admin.broadcast.form.content')}
          />
          {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.priority')}</label>
            <select
              value={form.priority}
              onChange={(event) => setField('priority', event.target.value)}
              className={cn(
                'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
                errors.priority && 'border-red-500 focus:ring-red-500'
              )}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`messages.priority.${value}`)}
                </option>
              ))}
            </select>
            {errors.priority && <p className="mt-1 text-sm text-red-600">{errors.priority}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.scope')}</label>
            <select
              value={form.scope}
              onChange={(event) => setField('scope', event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">{t('admin.broadcast.scope.all')}</option>
              <option value="custom">{t('admin.broadcast.scope.custom')}</option>
            </select>
          </div>
        </div>

        {form.scope === 'custom' && (
          <div className="space-y-4 rounded-lg border border-dashed bg-slate-50/60 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.targetUsers')}</label>
                <Input
                  placeholder={t('admin.broadcast.form.targetUsersPlaceholder')}
                  value={form.target_users_text}
                  onChange={(event) => setField('target_users_text', event.target.value)}
                  error={Boolean(errors.target_users_text)}
                />
                {errors.target_users_text ? (
                  <p className="mt-1 text-sm text-red-600">{errors.target_users_text}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {customTargetIds.length > 0
                      ? t('admin.broadcast.helper.customCount', { count: customTargetIds.length })
                      : t('admin.broadcast.helper.customEmpty')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">{t('admin.broadcast.recipients.selected', 'Selected recipients')}</h4>
                  {selectedRecipientIds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelectedRecipients}>
                      {t('common.clear', 'Clear')}
                    </Button>
                  )}
                </div>
                {selectedRecipientIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.broadcast.recipients.none', 'No individual recipients selected yet.')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipientList.map((entry) => {
                      const label = entry.username || entry.email || `#${entry.id}`;
                      return (
                        <Badge key={entry.id} variant="secondary" className="flex items-center gap-2">
                          <span>{label}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedRecipient(entry.id)}
                            className="text-xs text-muted-foreground hover:text-red-600"
                            aria-label={t('common.remove', 'Remove')}
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('admin.broadcast.recipients.selectedCount', 'Total selected: {{count}}', {
                    count: selectedRecipientIds.length,
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">{t('admin.broadcast.recipientFilters.title', 'Applied filter groups')}</h4>
                {appliedFilters.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setAppliedFilters([])}>
                    {t('common.clear', 'Clear')}
                  </Button>
                )}
              </div>
              {appliedFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.broadcast.recipientFilters.none', 'No filter groups added yet.')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {appliedFilters.map((filter, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-2">
                      <span>{describeFilter(filter)}</span>
                      <button
                        type="button"
                        onClick={() => removeFilterGroup(index)}
                        className="text-xs text-muted-foreground hover:text-red-600"
                        aria-label={t('common.remove', 'Remove')}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">{t('admin.broadcast.recipientSearch.title', 'Advanced recipient search')}</h4>
                  <p className="text-xs text-muted-foreground">{t('admin.broadcast.recipientSearch.description', 'Filter users by school, email domain or other attributes, then select individuals or add the filter group to this broadcast.')}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFilterGroup}
                  disabled={!hasRecipientCriteria}
                  title={!hasRecipientCriteria ? t('admin.broadcast.recipientFilters.hint', 'Set a condition above to enable this button.') : undefined}
                >
                  {t('admin.broadcast.recipientFilters.add', 'Add filter to broadcast')}
                </Button>
              </div>

              {!hasRecipientCriteria && (
                <p className="text-xs text-muted-foreground">{t('admin.broadcast.recipientFilters.hint', 'Set a condition above to enable this button.')}</p>
              )}

              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  value={recipientForm.search}
                  onChange={(event) => setRecipientField('search', event.target.value)}
                  placeholder={t('admin.broadcast.recipientSearch.searchPlaceholder', 'Search text (name, email, school...)')}
                />
                <select
                  value={recipientForm.fields}
                  onChange={(event) => setRecipientField('fields', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="username,email,school,location">{t('admin.broadcast.recipientSearch.fields.all', 'All key fields')}</option>
                  <option value="email">{t('admin.broadcast.recipientSearch.fields.email', 'Email')}</option>
                  <option value="school,school_name">{t('admin.broadcast.recipientSearch.fields.school', 'School')}</option>
                  <option value="location">{t('admin.broadcast.recipientSearch.fields.location', 'Location')}</option>
                  <option value="username">{t('admin.broadcast.recipientSearch.fields.username', 'Username')}</option>
                </select>
                <Input
                  value={recipientForm.school}
                  onChange={(event) => setRecipientField('school', event.target.value)}
                  placeholder={t('admin.broadcast.recipientSearch.schoolPlaceholder', 'School contains...')}
                />
                <Input
                  value={recipientForm.emailSuffix}
                  onChange={(event) => setRecipientField('emailSuffix', event.target.value)}
                  placeholder={t('admin.broadcast.recipientSearch.emailPlaceholder', 'Email domain e.g. example.com')}
                />
                <select
                  value={recipientForm.status}
                  onChange={(event) => setRecipientField('status', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="any">{t('admin.broadcast.recipientSearch.status.any', 'Any status')}</option>
                  <option value="active">{t('admin.broadcast.recipientSearch.status.active', 'Active')}</option>
                  <option value="inactive">{t('admin.broadcast.recipientSearch.status.inactive', 'Inactive')}</option>
                </select>
                <select
                  value={recipientForm.isAdmin}
                  onChange={(event) => setRecipientField('isAdmin', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="any">{t('admin.broadcast.recipientSearch.role.any', 'All roles')}</option>
                  <option value="1">{t('admin.broadcast.recipientSearch.role.admin', 'Admins')}</option>
                  <option value="0">{t('admin.broadcast.recipientSearch.role.user', 'Regular users')}</option>
                </select>
                <select
                  value={recipientForm.limit}
                  onChange={(event) => setRecipientField('limit', Number(event.target.value) || 25)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {[10, 25, 50, 100].map((value) => (
                    <option key={value} value={value}>
                      {t('admin.broadcast.recipientSearch.limit', { count: value })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleRecipientSearch} disabled={recipientLoading}>
                  {recipientLoading ? t('common.loading', 'Loading...') : t('common.search', 'Search')}
                </Button>
                <Button type="button" variant="outline" onClick={addAllRecipientsFromResults} disabled={recipientLoading || recipientResults.items.length === 0}>
                  {t('admin.broadcast.recipientSearch.addAll', 'Add visible recipients')}
                </Button>
                <Button type="button" variant="ghost" onClick={clearRecipientSearch} disabled={recipientLoading}>
                  {t('common.reset', 'Reset')}
                </Button>
              </div>

              {recipientError && (
                <Alert variant="destructive">
                  <AlertTitle>{t('admin.broadcast.recipientSearch.error', 'Search failed')}</AlertTitle>
                  <AlertDescription>{recipientError.message ?? t('common.retry', 'Please retry later.')}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {recipientLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>}
                {!recipientLoading && recipientResults.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.broadcast.recipientSearch.noResults', 'No users match the current search conditions.')}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t('admin.broadcast.recipientSearch.resultCount', {
                        count: recipientResults.items.length,
                      })}
                    </p>
                    {recipientResults.items.map((item) => {
                      const id = Number(item?.id ?? 0);
                      const checked = selectedRecipients.has(id);
                      const label = item.username || item.email || `#${id}`;
                      return (
                        <label
                          key={id}
                          className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleRecipientSelection(item)} />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-800">{label}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.email ? item.email : t('admin.broadcast.recipientSearch.noEmail', 'No email on file')}
                              {item.school ? ` • ${item.school}` : ''}
                            </p>
                          </div>
                        </label>
                      );
                    })}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <p className="text-xs text-muted-foreground">
                        {t('admin.broadcast.recipientSearch.pageInfo', {
                          page: recipientResults.pagination.page,
                        })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecipientPageChange('prev')}
                          disabled={recipientLoading || recipientResults.pagination.page === 1}
                        >
                          {t('common.previous', 'Previous')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecipientPageChange('next')}
                          disabled={recipientLoading || !recipientResults.pagination.has_more}
                        >
                          {t('common.next', 'Next')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handlePreview} disabled={isSubmitting}>
            {t('admin.broadcast.preview')}
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSubmitting}>
            {isSubmitting ? t('common.sending') : t('admin.broadcast.send')}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{t('admin.broadcast.previewPanel')}</h3>
            <Badge variant="secondary">{t(`messages.priority.${preview.priority}`)}</Badge>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{preview.scope === 'custom'
              ? t('admin.broadcast.previewTargets.custom', { count: preview.targetCount ?? 0 })
              : t('admin.broadcast.previewTargets.all')}</div>
            <div>
              <span className="text-sm text-gray-500 mr-2">{t('admin.broadcast.form.title')}:</span>
              <span className="font-medium">{preview.title}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500 mr-2">{t('admin.broadcast.form.content')}:</span>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{preview.content}</p>
            </div>
          </div>
          <Alert className="mt-4" variant="info">
            <AlertTitle>{t('admin.broadcast.noticeTitle')}</AlertTitle>
            <AlertDescription>{t('admin.broadcast.noticeDesc')}</AlertDescription>
          </Alert>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{t('admin.broadcast.result.title')}</h3>
            <Badge variant="outline">{t(`messages.priority.${result.priority}`)}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <ResultStat label={t('admin.broadcast.result.sent')} value={result.sent} tone="success" />
            <ResultStat label={t('admin.broadcast.result.targets')} value={result.total} />
            <ResultStat
              label={t('admin.broadcast.result.failed')}
              value={failedCount || t('admin.broadcast.result.none')}
              tone={failedCount ? 'danger' : 'default'}
            />
            <ResultStat
              label={t('admin.broadcast.result.invalid')}
              value={invalidCount || t('admin.broadcast.result.none')}
              tone={invalidCount ? 'warning' : 'default'}
            />
          </div>

          {failedCount > 0 && (
            <Alert variant="destructive">
              <AlertTitle>{t('admin.broadcast.result.failed')}</AlertTitle>
              <AlertDescription>
                <p>{t('admin.broadcast.result.failedHint')}</p>
                <span className="mt-2 block font-mono text-xs">{result.failed.join(', ')}</span>
              </AlertDescription>
            </Alert>
          )}

          {invalidCount > 0 && (
            <Alert variant="warning">
              <AlertTitle>{t('admin.broadcast.result.invalid')}</AlertTitle>
              <AlertDescription>
                <p>{t('admin.broadcast.result.invalidHint')}</p>
                <span className="mt-2 block font-mono text-xs">{result.invalid.join(', ')}</span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">{t('admin.broadcast.history.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('admin.broadcast.history.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => resetFilters()} disabled={isHistoryLoading || isHistoryFetching}>
              {t('common.reset')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={isHistoryLoading}>
              {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exportDisabled || isHistoryLoading}>
              {t('admin.broadcast.export.label')}
            </Button>
          </div>
        </div>

        {historyError && (
          <Alert variant="destructive">
            <AlertTitle>{t('admin.broadcast.sendFailed')}</AlertTitle>
            <AlertDescription>{historyError.message ?? 'Failed to load history.'}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <ResultStat label={t('admin.broadcast.summary.broadcasts')} value={summary.broadcasts} />
          <ResultStat label={t('admin.broadcast.summary.targets')} value={summary.targets} />
          <ResultStat label={t('admin.broadcast.summary.delivered')} value={summary.sent} tone="success" />
          <ResultStat label={t('admin.broadcast.summary.read')} value={summary.read} />
          <ResultStat label={t('admin.broadcast.summary.unread')} value={summary.unread} tone={summary.unread ? 'warning' : 'default'} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.filters.search')}</label>
            <Input
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder={t('admin.broadcast.filters.searchPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.filters.priority')}</label>
            <select
              value={filters.priority}
              onChange={(event) => updateFilters({ priority: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="any">{t('common.all')}</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`messages.priority.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.filters.scope')}</label>
            <select
              value={filters.scope}
              onChange={(event) => updateFilters({ scope: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="any">{t('common.all')}</option>
              <option value="all">{t('admin.broadcast.scope.all')}</option>
              <option value="custom">{t('admin.broadcast.scope.custom')}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="broadcast-unread-toggle"
            checked={filters.unreadOnly}
            onCheckedChange={(checked) => updateFilters({ unreadOnly: Boolean(checked) })}
          />
          <label htmlFor="broadcast-unread-toggle" className="text-sm text-muted-foreground">
            {t('admin.broadcast.filters.onlyUnread')}
          </label>
        </div>

        {isHistoryLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.broadcast.history.empty')}</p>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const isExpanded = !!expanded[item.id];
              const read = truncateUsers(item.read_users ?? []);
              const unread = truncateUsers(item.unread_users ?? []);
              const invalidIds = item.invalid_user_ids ?? [];
              const failedIds = item.failed_user_ids ?? [];
              const actorLabel = item.actor_username || (item.actor_user_id ? `#${item.actor_user_id}` : t('common.unknown'));

              return (
                <div key={item.id} className="rounded-lg border p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-lg font-semibold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{formatDateTime(item.created_at)}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('admin.broadcast.sentBy', {
                          actor: actorLabel,
                          id: item.actor_user_id ?? t('common.unknown'),
                        })}
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.content}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{t(`messages.priority.${item.priority}`)}</Badge>
                      <Badge variant="secondary">{t(`admin.broadcast.scope.${item.scope === 'custom' ? 'custom' : 'all'}`)}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <ResultStat label={t('admin.broadcast.result.sent')} value={item.sent_count} tone="success" />
                    <ResultStat label={t('admin.broadcast.result.targets')} value={item.target_count} />
                    <ResultStat
                      label={t('admin.broadcast.result.failed')}
                      value={failedIds.length || t('admin.broadcast.result.none')}
                      tone={(failedIds.length ?? 0) > 0 ? 'danger' : 'default'}
                    />
                    <ResultStat
                      label={t('admin.broadcast.result.invalid')}
                      value={invalidIds.length || t('admin.broadcast.result.none')}
                      tone={(invalidIds.length ?? 0) > 0 ? 'warning' : 'default'}
                    />
                  </div>

                  {failedIds.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTitle>{t('admin.broadcast.result.failed')}</AlertTitle>
                      <AlertDescription>
                        <span className="font-mono text-xs">{failedIds.join(', ')}</span>
                      </AlertDescription>
                    </Alert>
                  )}

                  {invalidIds.length > 0 && (
                    <Alert variant="warning">
                      <AlertTitle>{t('admin.broadcast.result.invalid')}</AlertTitle>
                      <AlertDescription>
                        <span className="font-mono text-xs">{invalidIds.join(', ')}</span>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => toggleDetails(item.id)}>
                    {isExpanded ? t('admin.broadcast.history.hideDetails') : t('admin.broadcast.history.showDetails')}
                  </Button>

                  {isExpanded && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-green-700">
                          {t('admin.broadcast.result.sent')} ({item.read_count ?? read.list.length})
                        </h5>
                        <UserChips users={read.list} />
                        {read.more > 0 && (
                          <p className="text-xs text-muted-foreground">{t('admin.broadcast.history.more', { count: read.more })}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-yellow-700">
                          {t('admin.broadcast.result.unread')} ({item.unread_count ?? unread.list.length})
                        </h5>
                        <UserChips users={unread.list} />
                        {unread.more > 0 && (
                          <p className="text-xs text-muted-foreground">{t('admin.broadcast.history.more', { count: unread.more })}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={pagination.page ?? historyParams.page}
          totalPages={pagination.pages ?? 1}
          onPageChange={handlePageChange}
          itemsPerPage={pagination.limit ?? historyParams.limit}
          totalItems={pagination.total ?? filteredItems.length}
          className="pt-2"
        />
      </div>
    </div>
  );
}

export default BroadcastCenter;

