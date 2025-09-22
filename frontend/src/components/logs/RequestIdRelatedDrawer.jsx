import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../../hooks/useTranslation';

export function RequestIdRelatedDrawer({ open, onClose, requestId, data, loading, onRefresh }) {
  const { t } = useTranslation();
  if (!open) return null;

  const auditLogs = data?.audit || [];
  const errorLogs = data?.error || [];

  const renderEmpty = () => (
    <div className="text-xs text-muted-foreground">{t('common.none')}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-3xl h-full bg-white shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            {t('admin.systemLogs.drawer.title', { id: requestId })}
          </h2>
          <div className="flex items-center gap-2">
            <button className="text-sm text-blue-600" onClick={onRefresh}>
              {t('admin.systemLogs.drawer.refresh')}
            </button>
            <button className="text-gray-500" onClick={onClose} aria-label={t('common.close')}>
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-6 text-sm">
          {loading && <div>{t('admin.systemLogs.drawer.loading')}</div>}
          {!loading && (
            <>
              <Section title={t('admin.systemLogs.drawer.auditTitle', { count: auditLogs.length })}>
                {auditLogs.length === 0 && renderEmpty()}
                {auditLogs.map((log) => (
                  <div key={log.id} className="border rounded p-2 mb-2 bg-gray-50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <KV label={t('admin.systemLogs.columns.id')} value={log.id} />
                      <KV label={t('admin.systemLogs.columns.action')} value={log.action} />
                      <KV label={t('admin.systemLogs.columns.operation_category')} value={log.operation_category} />
                      <KV label={t('admin.systemLogs.columns.actor_type')} value={log.actor_type} />
                      <KV label={t('admin.systemLogs.columns.status')} value={log.status} />
                    </div>
                  </div>
                ))}
              </Section>

              <Section title={t('admin.systemLogs.drawer.errorsTitle', { count: errorLogs.length })}>
                {errorLogs.length === 0 && renderEmpty()}
                {errorLogs.map((log) => (
                  <div key={log.id} className="border rounded p-2 mb-2 bg-rose-50/60">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <KV label={t('admin.systemLogs.columns.error_type')} value={log.error_type} />
                      <KV label={t('admin.systemLogs.columns.error_file')} value={log.error_file} />
                      <KV label={t('admin.systemLogs.columns.error_line')} value={log.error_line} />
                    </div>
                    {log.error_message && (
                      <div className="font-mono text-[11px] break-all mt-1 text-muted-foreground">
                        {log.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <span className="text-muted-foreground mr-1">{label}:</span>
      <span className="font-mono">{String(value ?? '-')}</span>
    </div>
  );
}

RequestIdRelatedDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  requestId: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool,
  onRefresh: PropTypes.func
};

Section.propTypes = {
  title: PropTypes.node,
  children: PropTypes.node
};

KV.propTypes = {
  label: PropTypes.node,
  value: PropTypes.any
};

export default RequestIdRelatedDrawer;
