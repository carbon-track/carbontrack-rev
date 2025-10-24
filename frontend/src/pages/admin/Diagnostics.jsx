import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI } from '../../lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/Button';
import { RefreshCw, Activity, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

const CONNECTIVITY_BADGE_MAP = {
  ok: {
    variant: 'secondary',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  },
  error: {
    variant: 'destructive',
    className: '',
  },
  skipped: {
    variant: 'outline',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  not_checked: {
    variant: 'outline',
    className: 'border-slate-200 bg-white text-slate-600',
  },
  default: {
    variant: 'outline',
    className: 'border-slate-200 bg-white text-slate-600',
  },
};

async function fetchDiagnostics(params = {}) {
  const response = await adminAPI.getAiDiagnostics(params);
  const payload = response?.data;
  if (payload?.success) {
    return payload;
  }
  const message = payload?.error || 'Failed to load diagnostics';
  const error = new Error(message);
  error.response = response;
  throw error;
}

export default function AdminDiagnosticsPage() {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery(['admin-ai-diagnostics'], () => fetchDiagnostics(), {
    staleTime: 60_000,
    cacheTime: 300_000,
    retry: 1,
  });

  const diagnostics = data?.diagnostics ?? null;
  const configuration = diagnostics?.configuration ?? {};
  const client = diagnostics?.client ?? {};
  const commands = diagnostics?.commands ?? {};
  const connectivity = diagnostics?.connectivity ?? {};
  const connectivityStatus = connectivity?.status ?? 'not_checked';
  const connectivityBadge = CONNECTIVITY_BADGE_MAP[connectivityStatus] || CONNECTIVITY_BADGE_MAP.default;

  const errorMessage = useMemo(() => {
    if (!error) return null;
    const serverMessage = error?.response?.data?.error;
    return serverMessage || error.message || t('errors.loadFailed', 'Failed to load data');
  }, [error, t]);

  const lastUpdatedText = useMemo(() => {
    if (!diagnostics || !dataUpdatedAt) {
      return null;
    }
    try {
      const formatter = new Intl.DateTimeFormat(currentLanguage || undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
      const formatted = formatter.format(new Date(dataUpdatedAt));
      return t('admin.diagnostics.labels.lastUpdated', { value: formatted });
    } catch {
      return t('admin.diagnostics.labels.lastUpdated', {
        value: new Date(dataUpdatedAt).toLocaleString(),
      });
    }
  }, [currentLanguage, dataUpdatedAt, diagnostics, t]);

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refetch();
      if (result?.data?.diagnostics) {
        toast.success(t('admin.diagnostics.messages.refreshSuccess', 'Diagnostics updated'));
      }
      if (result.error) {
        const message = result.error?.response?.data?.error || result.error?.message;
        if (message) {
          toast.error(message);
        }
      }
    } catch (refreshError) {
      const message = refreshError?.response?.data?.error || refreshError?.message;
      toast.error(message || t('errors.loadFailed', 'Failed to load data'));
    }
  }, [refetch, t]);

  const connectivityCheck = useMutation(() => fetchDiagnostics({ check: true }), {
    onSuccess: (payload) => {
      queryClient.setQueryData(['admin-ai-diagnostics'], payload);
      toast.success(t('admin.diagnostics.messages.checkSuccess', 'Connectivity check finished'));
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.error || mutationError?.message;
      toast.error(
        t('admin.diagnostics.messages.checkFailed', {
          message: message || t('errors.loadFailed', 'Failed to load data'),
        })
      );
    },
  });

  const runConnectivityCheck = useCallback(async () => {
    try {
      await connectivityCheck.mutateAsync();
    } catch {
      // Error is handled in onError callback above
    }
  }, [connectivityCheck]);

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/60 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>{t('admin.diagnostics.title', 'AI Diagnostics')}</CardTitle>
          <CardDescription>
            {t(
              'admin.diagnostics.description',
              'Inspect AI assistant configuration, client status, and run live connectivity tests.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading || isFetching}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', (isLoading || isFetching) && 'animate-spin')} />
              {t('admin.diagnostics.actions.refresh', 'Refresh status')}
            </Button>
            <Button
              variant="secondary"
              onClick={runConnectivityCheck}
              disabled={isLoading || connectivityCheck.isLoading}
            >
              <Activity className="mr-2 h-4 w-4" />
              {t('admin.diagnostics.actions.check', 'Run connectivity check')}
            </Button>
            {isFetching && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('admin.diagnostics.actions.refreshing', 'Refreshing diagnostics...')}
              </span>
            )}
            {connectivityCheck.isLoading && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('admin.diagnostics.actions.checking', 'Checking connectivity...')}
              </span>
            )}
            {lastUpdatedText && (
              <Badge variant="outline" className="ml-auto border-slate-200 bg-white text-xs text-muted-foreground">
                {lastUpdatedText}
              </Badge>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading', 'Loading...')}
            </div>
          )}

          {isError && !isLoading && (
            <Alert variant="destructive" className="border-rose-200 bg-rose-50/90 text-rose-700">
              <AlertTitle>{t('common.error', 'Error')}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {diagnostics && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={diagnostics.enabled ? 'secondary' : 'destructive'}
                  className={cn(
                    'border text-xs',
                    diagnostics.enabled
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-rose-200 bg-rose-100 text-rose-700'
                  )}
                >
                  {diagnostics.enabled
                    ? t('admin.diagnostics.labels.enabled', 'AI assistant enabled')
                    : t('admin.diagnostics.labels.disabled', 'AI assistant disabled')}
                </Badge>
                {!diagnostics.enabled && (
                  <Alert variant="destructive" className="w-full border-rose-200 bg-rose-50/90 text-rose-700 sm:w-auto">
                    <AlertTitle>{t('admin.diagnostics.status.disabledTitle', 'Assistant disabled')}</AlertTitle>
                    <AlertDescription>
                      {t(
                        'admin.diagnostics.status.disabledDescription',
                        'Provide a valid LLM API key and configuration on the server to enable the assistant.'
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-4">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {t('admin.diagnostics.connectivity.title', 'Connectivity status')}
                  </h3>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant={connectivityBadge.variant}
                        className={cn('text-xs', connectivityBadge.className)}
                      >
                        {t(`admin.diagnostics.connectivity.status.${connectivityStatus}`, connectivityStatus)}
                      </Badge>
                      <span className="text-sm text-slate-600">
                        {t(`admin.diagnostics.connectivity.description.${connectivityStatus}`, connectivityStatus)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {connectivity?.model && (
                        <DataRow label={t('admin.diagnostics.connectivity.fields.model', 'Model')}>
                          <code className="font-mono text-xs">{connectivity.model}</code>
                        </DataRow>
                      )}
                      {connectivity?.finish_reason && (
                        <DataRow label={t('admin.diagnostics.connectivity.fields.finishReason', 'Finish reason')}>
                          {connectivity.finish_reason}
                        </DataRow>
                      )}
                      {connectivity?.reason && (
                        <DataRow label={t('admin.diagnostics.connectivity.fields.reason', 'Reason')}>
                          {connectivity.reason}
                        </DataRow>
                      )}
                      {connectivity?.error && (
                        <Alert variant="destructive" className="border-rose-200 bg-rose-50/90 text-rose-700">
                          <AlertTitle>{t('admin.diagnostics.connectivity.fields.error', 'Error message')}</AlertTitle>
                          <AlertDescription>{connectivity.error}</AlertDescription>
                        </Alert>
                      )}
                      {connectivity?.exception && (
                        <DataRow label={t('admin.diagnostics.connectivity.fields.exception', 'Exception')}>
                          <code className="font-mono text-xs">{connectivity.exception}</code>
                        </DataRow>
                      )}
                      {connectivity?.usage && (
                        <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('admin.diagnostics.connectivity.fields.usage', 'Usage')}
                          </p>
                          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900/90 p-3 text-xs leading-relaxed text-emerald-200">
                            {JSON.stringify(connectivity.usage, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {diagnostics && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-slate-200/70 bg-white/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {t('admin.diagnostics.configuration.title', 'Model configuration')}
              </CardTitle>
              <CardDescription>
                {t('admin.diagnostics.configuration.description', 'Current runtime settings for the assistant model.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DataRow label={t('admin.diagnostics.configuration.model', 'Model')}>
                {configuration.model ? <code className="font-mono text-xs">{configuration.model}</code> : null}
              </DataRow>
              <DataRow label={t('admin.diagnostics.configuration.temperature', 'Temperature')}>
                {typeof configuration.temperature === 'number' ? configuration.temperature.toFixed(2) : null}
              </DataRow>
              <DataRow label={t('admin.diagnostics.configuration.maxTokens', 'Max tokens')}>
                {configuration.maxTokens ?? null}
              </DataRow>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70 bg-white/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {t('admin.diagnostics.client.title', 'Client adapter')}
              </CardTitle>
              <CardDescription>
                {t('admin.diagnostics.client.description', 'Underlying HTTP client and adapter details.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DataRow label={t('admin.diagnostics.client.available', 'Client available')}>
                <Badge
                  variant={client.available ? 'secondary' : 'outline'}
                  className={cn(
                    'text-xs',
                    client.available
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  {client.available
                    ? t('admin.diagnostics.labels.yes', 'Yes')
                    : t('admin.diagnostics.labels.no', 'No')}
                </Badge>
              </DataRow>
              <DataRow label={t('admin.diagnostics.client.class', 'Adapter class')}>
                {client.class ? <code className="font-mono text-xs">{client.class}</code> : null}
              </DataRow>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70 bg-white/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">
                {t('admin.diagnostics.commands.title', 'Command catalog')}
              </CardTitle>
              <CardDescription>
                {t('admin.diagnostics.commands.description', 'Number of registered targets and automation actions.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DataRow label={t('admin.diagnostics.commands.navigation', 'Navigation targets')}>
                {commands.navigationTargets ?? 0}
              </DataRow>
              <DataRow label={t('admin.diagnostics.commands.quick', 'Quick actions')}>
                {commands.quickActions ?? 0}
              </DataRow>
              <DataRow label={t('admin.diagnostics.commands.management', 'Management actions')}>
                {commands.managementActions ?? 0}
              </DataRow>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DataRow({ label, children, className }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm shadow-sm',
        className
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-medium text-slate-900">
        {children ?? <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}
