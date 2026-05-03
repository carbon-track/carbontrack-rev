import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Copy, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import JsonTreeViewer from './JsonTreeViewer';
import AuditDiffViewer from './AuditDiffViewer';
import { fetchSystemLogDetail } from '../../lib/api/systemLogs';
import { adminAPI } from '../../lib/api';
import { maskServerMeta, redactLogEntry, safeParseLogValue } from '../../lib/logRedaction';

export function RequestIdRelatedDrawer({
  open,
  onClose,
  requestId,
  data,
  loading,
  onRefresh,
  system,
  audit,
  error,
  llm
}) {
  const { t } = useTranslation(['admin', 'common', 'errors']);
  const [systemDetails, setSystemDetails] = useState({});
  const [llmDetails, setLlmDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState({ system: {}, llm: {} });
  const [detailErrors, setDetailErrors] = useState({ system: {}, llm: {} });
  const [copyingKey, setCopyingKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [copyError, setCopyError] = useState('');
  const copyResetTimerRef = useRef(null);

  useEffect(() => {
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
    setSystemDetails({});
    setLlmDetails({});
    setDetailLoading({ system: {}, llm: {} });
    setDetailErrors({ system: {}, llm: {} });
    setCopyingKey(null);
    setCopiedKey(null);
    setCopyError('');
  }, [requestId]);

  useEffect(() => () => {
    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
    }
  }, []);

  const setLoadingFlag = useCallback((type, id, value) => {
    setDetailLoading((prev) => {
      const nextType = { ...prev[type] };
      if (value) {
        nextType[id] = true;
      } else {
        delete nextType[id];
      }
      return { ...prev, [type]: nextType };
    });
  }, []);

  const setErrorFlag = useCallback((type, id, message) => {
    setDetailErrors((prev) => {
      const nextType = { ...prev[type] };
      if (message) {
        nextType[id] = message;
      } else {
        delete nextType[id];
      }
      return { ...prev, [type]: nextType };
    });
  }, []);

  const loadSystemDetail = useCallback(async (id) => {
    if (!id || systemDetails[id] || detailLoading.system[id]) return;
    setLoadingFlag('system', id, true);
    setErrorFlag('system', id, null);
    try {
      const response = await fetchSystemLogDetail(id);
      const payload = response?.data || response;
      const detail = payload?.data || payload;
      setSystemDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      setErrorFlag('system', id, err?.message || t('errors.loadFailed'));
    } finally {
      setLoadingFlag('system', id, false);
    }
  }, [detailLoading.system, setErrorFlag, setLoadingFlag, systemDetails, t]);

  const loadLlmDetail = useCallback(async (id) => {
    if (!id || llmDetails[id] || detailLoading.llm[id]) return;
    setLoadingFlag('llm', id, true);
    setErrorFlag('llm', id, null);
    try {
      const response = await adminAPI.getLlmLogDetail(id);
      const payload = response?.data || response;
      const detail = payload?.data || payload;
      setLlmDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      setErrorFlag('llm', id, err?.message || t('errors.loadFailed'));
    } finally {
      setLoadingFlag('llm', id, false);
    }
  }, [detailLoading.llm, llmDetails, setErrorFlag, setLoadingFlag, t]);

  const resolved = useMemo(() => data ?? { system, audit, error, llm }, [audit, data, error, llm, system]);
  const systemLogs = useMemo(() => (Array.isArray(resolved.system) ? resolved.system : []), [resolved.system]);
  const auditLogs = useMemo(() => (Array.isArray(resolved.audit) ? resolved.audit : []), [resolved.audit]);
  const errorLogs = useMemo(() => (Array.isArray(resolved.error) ? resolved.error : []), [resolved.error]);
  const llmLogs = useMemo(() => (Array.isArray(resolved.llm) ? resolved.llm : []), [resolved.llm]);

  const fetchSystemDetailForCopy = useCallback(async (log) => {
    if (!log?.id) return log;
    if (systemDetails[log.id]) return systemDetails[log.id];
    try {
      const response = await fetchSystemLogDetail(log.id);
      const payload = response?.data || response;
      const detail = payload?.data || payload || log;
      setSystemDetails((prev) => ({ ...prev, [log.id]: detail }));
      return detail;
    } catch (err) {
      return {
        ...log,
        detail_load_error: err?.message || t('errors.loadFailed'),
      };
    }
  }, [systemDetails, t]);

  const fetchLlmDetailForCopy = useCallback(async (log) => {
    if (!log?.id) return log;
    if (llmDetails[log.id]) return llmDetails[log.id];
    try {
      const response = await adminAPI.getLlmLogDetail(log.id);
      const payload = response?.data || response;
      const detail = payload?.data || payload || log;
      setLlmDetails((prev) => ({ ...prev, [log.id]: detail }));
      return detail;
    } catch (err) {
      return {
        ...log,
        detail_load_error: err?.message || t('errors.loadFailed'),
      };
    }
  }, [llmDetails, t]);

  const getRedactedCategoryLogs = useCallback(async (type) => {
    if (type === 'system') {
      const logs = await Promise.all(systemLogs.map((log) => fetchSystemDetailForCopy(log)));
      return logs.map((log) => redactLogEntry(log));
    }
    if (type === 'audit') {
      return auditLogs.map((log) => redactLogEntry(log));
    }
    if (type === 'error') {
      return errorLogs.map((log) => redactLogEntry(log));
    }
    if (type === 'llm') {
      const logs = await Promise.all(llmLogs.map((log) => fetchLlmDetailForCopy(log)));
      return logs.map((log) => redactLogEntry(log));
    }
    return [];
  }, [auditLogs, errorLogs, fetchLlmDetailForCopy, fetchSystemDetailForCopy, llmLogs, systemLogs]);

  const getRedactedSingleLog = useCallback(async (type, log) => {
    if (type === 'system') {
      return redactLogEntry(await fetchSystemDetailForCopy(log));
    }
    if (type === 'llm') {
      return redactLogEntry(await fetchLlmDetailForCopy(log));
    }
    return redactLogEntry(log);
  }, [fetchLlmDetailForCopy, fetchSystemDetailForCopy]);

  const copyPayload = useCallback(async (key, buildPayload) => {
    setCopyingKey(key);
    setCopyError('');
    try {
      const payload = await buildPayload();
      await writeClipboard(JSON.stringify(payload, null, 2));
      setCopiedKey(key);
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
        copyResetTimerRef.current = null;
      }, 1800);
    } catch (err) {
      setCopyError(err?.message || t('admin.systemLogs.drawer.copyFailed'));
    } finally {
      setCopyingKey(null);
    }
  }, [t]);

  const copyAllLogs = useCallback(() => copyPayload('all', async () => ({
    request_id: requestId,
    copied_at: new Date().toISOString(),
    logs: {
      system: await getRedactedCategoryLogs('system'),
      audit: await getRedactedCategoryLogs('audit'),
      error: await getRedactedCategoryLogs('error'),
      llm: await getRedactedCategoryLogs('llm'),
    },
  })), [copyPayload, getRedactedCategoryLogs, requestId]);

  const copyCategoryLogs = useCallback((type) => copyPayload(`category-${type}`, async () => ({
    request_id: requestId,
    type,
    copied_at: new Date().toISOString(),
    logs: await getRedactedCategoryLogs(type),
  })), [copyPayload, getRedactedCategoryLogs, requestId]);

  const copySingleLog = useCallback((type, log) => copyPayload(`${type}-${log?.id ?? 'item'}`, async () => ({
    request_id: requestId,
    type,
    copied_at: new Date().toISOString(),
    log: await getRedactedSingleLog(type, log),
  })), [copyPayload, getRedactedSingleLog, requestId]);

  if (!open) return null;

  const columnLabel = (key) => t(`admin.systemLogs.columns.${key}`, { defaultValue: key });

  const renderEmpty = () => (
    <div className="text-xs text-muted-foreground">{t('common.none')}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-background text-foreground shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur">
          <h2 className="text-lg font-semibold">
            {t('admin.systemLogs.drawer.title', { id: requestId })}
          </h2>
          <div className="flex items-center gap-2">
            <CopyActionButton
              label={t('admin.systemLogs.drawer.copyAll')}
              copiedLabel={t('admin.systemLogs.drawer.copied')}
              loading={copyingKey === 'all'}
              copied={copiedKey === 'all'}
              onClick={copyAllLogs}
            />
            <button type="button" className="text-sm text-primary transition-colors hover:text-primary/80" onClick={onRefresh}>
              {t('admin.systemLogs.drawer.refresh')}
            </button>
            <button
              type="button"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              &times;
            </button>
          </div>
        </div>
        {copyError && (
          <div className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
            {copyError}
          </div>
        )}
        <div className="flex-1 space-y-6 overflow-auto p-4 text-sm">
          {loading && <div className="text-muted-foreground">{t('admin.systemLogs.drawer.loading')}</div>}
          {!loading && (
            <>
              <Section
                title={t('admin.systemLogs.drawer.systemTitle', { count: systemLogs.length })}
                actions={(
                  <CopyActionButton
                    label={t('admin.systemLogs.drawer.copyCategory')}
                    copiedLabel={t('admin.systemLogs.drawer.copied')}
                    loading={copyingKey === 'category-system'}
                    copied={copiedKey === 'category-system'}
                    disabled={systemLogs.length === 0}
                    onClick={() => copyCategoryLogs('system')}
                  />
                )}
              >
                {systemLogs.length === 0 && renderEmpty()}
                {systemLogs.map((log) => {
                  const detail = systemDetails[log.id];
                  const isLoading = detailLoading.system[log.id];
                  const errorMessage = detailErrors.system[log.id];
                  const detailData = detail || log;
                  return (
                    <ExpandableItem
                      key={`system-${log.id}`}
                      toneClass="border-border bg-muted/40"
                      summary={(
                        <>
                          <KeyValueItem label={columnLabel('id')} value={log.id} />
                          <KeyValueItem label={columnLabel('method')} value={log.method} />
                          <KeyValueItem label={columnLabel('path')} value={log.path} />
                          <KeyValueItem label={columnLabel('status_code')} value={log.status_code} />
                          <KeyValueItem label={columnLabel('duration_ms')} value={log.duration_ms} />
                          <KeyValueItem label={columnLabel('created_at')} value={log.created_at} />
                        </>
                      )}
                      onOpen={() => loadSystemDetail(log.id)}
                      openLabel={t('admin.systemLogs.actions.expand')}
                      closeLabel={t('admin.systemLogs.actions.collapse')}
                      actions={(
                        <CopyActionButton
                          label={t('admin.systemLogs.drawer.copyItem')}
                          copiedLabel={t('admin.systemLogs.drawer.copied')}
                          loading={copyingKey === `system-${log.id}`}
                          copied={copiedKey === `system-${log.id}`}
                          compact
                          onClick={() => copySingleLog('system', log)}
                        />
                      )}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <DetailGrid
                            items={[
                              { label: columnLabel('request_id'), value: detailData.request_id || requestId },
                              { label: columnLabel('method'), value: detailData.method },
                              { label: columnLabel('path'), value: detailData.path, span: true },
                              { label: columnLabel('status_code'), value: detailData.status_code },
                              { label: columnLabel('user_id'), value: detailData.user_id ?? '-' },
                              { label: columnLabel('duration_ms'), value: detailData.duration_ms ?? '-' },
                              { label: columnLabel('ip_address'), value: detailData.ip_address ?? '-' },
                              { label: columnLabel('created_at'), value: detailData.created_at ?? '-' },
                              { label: columnLabel('user_agent'), value: detailData.user_agent ?? '-', span: true }
                            ]}
                          />
                          {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t('common.loading')}
                            </div>
                          )}
                          {errorMessage && (
                            <div className="text-xs text-rose-600">{errorMessage}</div>
                          )}
                          {detail && (
                            <>
                              <DetailValueBlock title={t('admin.systemLogs.requestBody')} value={detail.request_body} />
                              <DetailValueBlock title={t('admin.systemLogs.responseBody')} value={detail.response_body} />
                              <DetailValueBlock title={t('admin.systemLogs.serverMeta')} value={maskServerMeta(detail.server_meta)} />
                            </>
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Section>

              <Section
                title={t('admin.systemLogs.drawer.auditTitle', { count: auditLogs.length })}
                actions={(
                  <CopyActionButton
                    label={t('admin.systemLogs.drawer.copyCategory')}
                    copiedLabel={t('admin.systemLogs.drawer.copied')}
                    loading={copyingKey === 'category-audit'}
                    copied={copiedKey === 'category-audit'}
                    disabled={auditLogs.length === 0}
                    onClick={() => copyCategoryLogs('audit')}
                  />
                )}
              >
                {auditLogs.length === 0 && renderEmpty()}
                {auditLogs.map((log) => (
                  <ExpandableItem
                    key={`audit-${log.id}`}
                    toneClass="border-border bg-muted/40"
                    summary={(
                      <>
                        <KeyValueItem label={columnLabel('id')} value={log.id} />
                        <KeyValueItem label={columnLabel('action')} value={log.action} />
                        <KeyValueItem label={columnLabel('operation_category')} value={log.operation_category} />
                        <KeyValueItem label={columnLabel('actor_type')} value={log.actor_type} />
                        <KeyValueItem label={columnLabel('status')} value={log.status} />
                        <KeyValueItem label={columnLabel('created_at')} value={log.created_at} />
                      </>
                    )}
                    openLabel={t('admin.systemLogs.actions.expand')}
                    closeLabel={t('admin.systemLogs.actions.collapse')}
                    actions={(
                      <CopyActionButton
                        label={t('admin.systemLogs.drawer.copyItem')}
                        copiedLabel={t('admin.systemLogs.drawer.copied')}
                        loading={copyingKey === `audit-${log.id}`}
                        copied={copiedKey === `audit-${log.id}`}
                        compact
                        onClick={() => copySingleLog('audit', log)}
                      />
                    )}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <DetailGrid
                          items={[
                            { label: columnLabel('id'), value: log.id },
                            { label: columnLabel('action'), value: log.action },
                            { label: columnLabel('operation_category'), value: log.operation_category || '-' },
                            { label: columnLabel('actor_type'), value: log.actor_type },
                            { label: columnLabel('status'), value: log.status },
                            { label: columnLabel('user_id'), value: log.user_id ?? '-' },
                            { label: columnLabel('ip_address'), value: log.ip_address ?? '-' },
                            { label: columnLabel('created_at'), value: log.created_at }
                          ]}
                        />
                        {(log.old_data || log.new_data) && (
                          <AuditDiffViewer oldData={log.old_data} newData={log.new_data} />
                        )}
                        {log.data && (
                          <DetailValueBlock title={t('admin.audit.requestData')} value={log.data} />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Section>

              <Section
                title={t('admin.systemLogs.drawer.errorsTitle', { count: errorLogs.length })}
                actions={(
                  <CopyActionButton
                    label={t('admin.systemLogs.drawer.copyCategory')}
                    copiedLabel={t('admin.systemLogs.drawer.copied')}
                    loading={copyingKey === 'category-error'}
                    copied={copiedKey === 'category-error'}
                    disabled={errorLogs.length === 0}
                    onClick={() => copyCategoryLogs('error')}
                  />
                )}
              >
                {errorLogs.length === 0 && renderEmpty()}
                {errorLogs.map((log) => (
                  <ExpandableItem
                    key={`error-${log.id}`}
                    toneClass="border-rose-500/20 bg-rose-500/10"
                    summary={(
                      <>
                        <KeyValueItem label={columnLabel('request_id')} value={log.request_id || requestId} />
                        <KeyValueItem label={columnLabel('error_type')} value={log.error_type} />
                        <KeyValueItem label={columnLabel('error_file')} value={log.error_file} />
                        <KeyValueItem label={columnLabel('error_line')} value={log.error_line} />
                        <KeyValueItem label={columnLabel('error_time')} value={log.error_time} />
                      </>
                    )}
                    openLabel={t('admin.systemLogs.actions.expand')}
                    closeLabel={t('admin.systemLogs.actions.collapse')}
                    actions={(
                      <CopyActionButton
                        label={t('admin.systemLogs.drawer.copyItem')}
                        copiedLabel={t('admin.systemLogs.drawer.copied')}
                        loading={copyingKey === `error-${log.id}`}
                        copied={copiedKey === `error-${log.id}`}
                        compact
                        onClick={() => copySingleLog('error', log)}
                      />
                    )}
                    detail={(
                      <div className="space-y-3 text-xs">
                        <DetailGrid
                          items={[
                            { label: columnLabel('request_id'), value: log.request_id || requestId },
                            { label: columnLabel('error_type'), value: log.error_type },
                            { label: columnLabel('error_file'), value: log.error_file },
                            { label: columnLabel('error_line'), value: log.error_line },
                            { label: columnLabel('error_time'), value: log.error_time }
                          ]}
                        />
                        {log.error_message && (
                          <DetailTextBlock
                            title={columnLabel('error_message')}
                            value={log.error_message}
                            toneClass="border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          />
                        )}
                      </div>
                    )}
                  />
                ))}
              </Section>

              <Section
                title={t('admin.systemLogs.drawer.llmTitle', { count: llmLogs.length })}
                actions={(
                  <CopyActionButton
                    label={t('admin.systemLogs.drawer.copyCategory')}
                    copiedLabel={t('admin.systemLogs.drawer.copied')}
                    loading={copyingKey === 'category-llm'}
                    copied={copiedKey === 'category-llm'}
                    disabled={llmLogs.length === 0}
                    onClick={() => copyCategoryLogs('llm')}
                  />
                )}
              >
                {llmLogs.length === 0 && renderEmpty()}
                {llmLogs.map((log) => {
                  const detail = llmDetails[log.id];
                  const isLoading = detailLoading.llm[log.id];
                  const errorMessage = detailErrors.llm[log.id];
                  const detailData = detail || log;
                  return (
                    <ExpandableItem
                      key={`llm-${log.id}`}
                      toneClass="border-indigo-500/20 bg-indigo-500/10"
                      summary={(
                        <>
                          <KeyValueItem label={columnLabel('actor_type')} value={log.actor_type} />
                          <KeyValueItem label={columnLabel('actor_id')} value={log.actor_id} />
                          <KeyValueItem label={columnLabel('model')} value={log.model} />
                          <KeyValueItem label={columnLabel('llm_status')} value={log.status} />
                          <KeyValueItem label={columnLabel('total_tokens')} value={log.total_tokens} />
                          <KeyValueItem label={columnLabel('latency_ms')} value={log.latency_ms} />
                          <KeyValueItem label={columnLabel('created_at')} value={log.created_at} />
                        </>
                      )}
                      onOpen={() => loadLlmDetail(log.id)}
                      openLabel={t('admin.systemLogs.actions.expand')}
                      closeLabel={t('admin.systemLogs.actions.collapse')}
                      actions={(
                        <CopyActionButton
                          label={t('admin.systemLogs.drawer.copyItem')}
                          copiedLabel={t('admin.systemLogs.drawer.copied')}
                          loading={copyingKey === `llm-${log.id}`}
                          copied={copiedKey === `llm-${log.id}`}
                          compact
                          onClick={() => copySingleLog('llm', log)}
                        />
                      )}
                      detail={(
                        <div className="space-y-3 text-xs">
                          <DetailGrid
                            items={[
                              { label: columnLabel('request_id'), value: detailData.request_id || requestId },
                              { label: columnLabel('actor_type'), value: detailData.actor_type },
                              { label: columnLabel('actor_id'), value: detailData.actor_id ?? '-' },
                              { label: columnLabel('source'), value: detailData.source || '-' },
                              { label: columnLabel('model'), value: detailData.model || '-' },
                              { label: columnLabel('llm_status'), value: detailData.status || '-' },
                              { label: columnLabel('response_id'), value: detailData.response_id || '-' },
                              { label: columnLabel('total_tokens'), value: detailData.total_tokens ?? '-' },
                              { label: columnLabel('latency_ms'), value: detailData.latency_ms ?? '-' },
                              { label: columnLabel('created_at'), value: detailData.created_at ?? '-' }
                            ]}
                          />
                          {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t('common.loading')}
                            </div>
                          )}
                          {errorMessage && (
                            <div className="text-xs text-rose-600">{errorMessage}</div>
                          )}
                          <DetailValueBlock
                            title={t('admin.llmUsage.logs.prompt')}
                            value={detail?.prompt ?? log.prompt}
                          />
                          {detail?.response_raw && (
                            <DetailValueBlock
                              title={t('admin.llmUsage.logs.response')}
                              value={detail.response_raw}
                            />
                          )}
                          {(detail?.error_message || log.error_message) && (
                            <DetailTextBlock
                              title={t('admin.llmUsage.logs.error')}
                              value={detail?.error_message || log.error_message}
                              toneClass="border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            />
                          )}
                          {detail?.usage && (
                            <DetailValueBlock title="usage" value={detail.usage} />
                          )}
                          {detail?.context && (
                            <DetailValueBlock title="context" value={detail.context} />
                          )}
                        </div>
                      )}
                    />
                  );
                })}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, actions, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ExpandableItem({ summary, detail, openLabel, closeLabel, onOpen, toneClass, actions }) {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      return next;
    });
  };

  return (
    <div className={`mb-2 rounded-lg border p-3 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">{summary}</div>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            className="text-[11px] text-primary transition-colors hover:text-primary/80"
            onClick={toggleOpen}
            aria-expanded={open}
          >
            {open ? closeLabel : openLabel}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          {detail}
        </div>
      )}
    </div>
  );
}

function CopyActionButton({ label, copiedLabel, loading, copied, disabled, compact, onClick }) {
  const text = copied ? copiedLabel : label;
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={text}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{text}</span>
    </button>
  );
}

function KeyValueItem({ label, value }) {
  return (
    <div>
      <span className="mr-1 text-muted-foreground">{label}:</span>
      <span className="font-mono">{String(value ?? '-')}</span>
    </div>
  );
}

function DetailGrid({ items }) {
  return (
    <div className="grid gap-2 text-[11px] md:grid-cols-2">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={item.span ? 'md:col-span-2' : ''}>
          <KeyValueItem label={item.label} value={item.value} />
        </div>
      ))}
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailValueBlock({ title, value }) {
  if (value == null || value === '') return null;
  return (
    <DetailBlock title={title}>
      <DetailValue value={value} />
    </DetailBlock>
  );
}

function DetailTextBlock({ title, value, toneClass }) {
  if (value == null || value === '') return null;
  return (
    <DetailBlock title={title}>
      <pre className={`max-h-64 overflow-auto whitespace-pre-wrap rounded p-3 text-[11px] ${toneClass}`}>
        {String(value)}
      </pre>
    </DetailBlock>
  );
}

function DetailValue({ value }) {
  if (value == null || value === '') return null;
  const parsed = parseMaybeJson(value);
  if (typeof parsed === 'string') {
    return (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-slate-950 p-3 text-[11px] text-slate-100">
        {parsed}
      </pre>
    );
  }
  return <JsonTreeViewer value={parsed} collapsed maxHeight="18rem" />;
}

function parseMaybeJson(value) {
  return safeParseLogValue(value);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('Copy failed');
  }
}

RequestIdRelatedDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  requestId: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool,
  onRefresh: PropTypes.func,
  system: PropTypes.array,
  audit: PropTypes.array,
  error: PropTypes.array,
  llm: PropTypes.array
};

Section.propTypes = {
  title: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node
};

ExpandableItem.propTypes = {
  summary: PropTypes.node,
  detail: PropTypes.node,
  openLabel: PropTypes.node,
  closeLabel: PropTypes.node,
  onOpen: PropTypes.func,
  toneClass: PropTypes.string,
  actions: PropTypes.node
};

CopyActionButton.propTypes = {
  label: PropTypes.node,
  copiedLabel: PropTypes.node,
  loading: PropTypes.bool,
  copied: PropTypes.bool,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  onClick: PropTypes.func
};

KeyValueItem.propTypes = {
  label: PropTypes.node,
  value: PropTypes.any
};

DetailGrid.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.node,
    value: PropTypes.any,
    span: PropTypes.bool
  }))
};

DetailBlock.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node
};

DetailValueBlock.propTypes = {
  title: PropTypes.node,
  value: PropTypes.any
};

DetailTextBlock.propTypes = {
  title: PropTypes.node,
  value: PropTypes.any,
  toneClass: PropTypes.string
};

DetailValue.propTypes = {
  value: PropTypes.any
};

export default RequestIdRelatedDrawer;
