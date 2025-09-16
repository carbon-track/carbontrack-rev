import React from 'react';
import PropTypes from 'prop-types';
import JsonTreeViewer from './JsonTreeViewer';

export function RequestIdRelatedDrawer({ open, onClose, requestId, data, loading, onRefresh }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-3xl h-full bg-white shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Request ID: {requestId}</h2>
          <div className="flex items-center gap-2">
            <button className="text-sm text-blue-600" onClick={onRefresh}>Refresh</button>
            <button className="text-gray-500" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-6 text-sm">
          {loading && <div>Loading related...</div>}
          {!loading && data && (
            <>
              <Section title={`Audit (${data.audit?.length || 0})`}>
                {data.audit?.map(a => (
                  <div key={a.id} className="border rounded p-2 mb-2 bg-gray-50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <KV k="ID" v={a.id} /><KV k="Action" v={a.action} /><KV k="Category" v={a.operation_category} /><KV k="Actor" v={a.actor_type} /><KV k="Status" v={a.status} />
                    </div>
                  </div>
                )) || <div className="text-xs text-gray-400">None</div>}
              </Section>
              <Section title={`Errors (${data.error?.length || 0})`}>
                {data.error?.map(e => (
                  <div key={e.id} className="border rounded p-2 mb-2 bg-rose-50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <KV k="Type" v={e.error_type} /><KV k="File" v={e.error_file} /><KV k="Line" v={e.error_line} />
                    </div>
                    <div className="font-mono text-[11px] break-all mt-1">{e.error_message}</div>
                  </div>
                )) || <div className="text-xs text-gray-400">None</div>}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) { return <div><h3 className="font-semibold mb-2">{title}</h3>{children}</div>; }
function KV({ k, v }) { return <div><span className="text-gray-500 mr-1">{k}:</span><span className="font-mono">{String(v ?? '-') }</span></div>; }

RequestIdRelatedDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  requestId: PropTypes.string,
  data: PropTypes.object,
  loading: PropTypes.bool,
  onRefresh: PropTypes.func
};

export default RequestIdRelatedDrawer;
