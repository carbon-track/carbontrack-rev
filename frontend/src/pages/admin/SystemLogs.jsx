/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/prop-types */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useSystemLogDetail } from '../../hooks/useSystemLogs';
import { useLogSearch } from '../../hooks/useLogSearch';
import { parseLogQuery } from '../../lib/logQueryParser';
import { fetchRelatedLogs, exportLogs } from '../../lib/api/logSearch';
import TimelineView from '../../components/logs/TimelineView';
import RawView from '../../components/logs/RawView';
import RequestIdRelatedDrawer from '../../components/logs/RequestIdRelatedDrawer';
import JsonTreeViewer from '../../components/logs/JsonTreeViewer';
import AuditDiffViewer from '../../components/logs/AuditDiffViewer';

function JsonViewer({ data }) {
  const json = useMemo(() => {
    try { return JSON.stringify(data, null, 2); } catch { return String(data); }
  }, [data]);
  return (
    <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded overflow-auto max-h-96">
      {json}
    </pre>
  );
}

function safeParse(val) {
  if (val == null) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return val; }
}

export default function SystemLogsPage() {
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTypes, setActiveTypes] = useState(['system','audit','error']);
  const [limitPerType, setLimitPerType] = useState(50);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [view, setView] = useState('table'); // table | timeline | raw
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [requestDrawerId, setRequestDrawerId] = useState(null);
  const [related, setRelated] = useState({ system:[], audit:[], error:[] });
  const [loadingRelated, setLoadingRelated] = useState(false);
  // column chooser state
  const SYSTEM_COLS = ['id','method','path','status_code','user_id','duration_ms','created_at','ops'];
  const AUDIT_COLS = ['id','actor_type','action','operation_category','status','user_id','ip_address','created_at','ops'];
  const ERROR_COLS = ['id','error_type','error_message','error_file','error_line','error_time','ops'];
  const [systemCols, setSystemCols] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('logCols_system')) || SYSTEM_COLS; } catch { return SYSTEM_COLS; }
  });
  const [auditCols, setAuditCols] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('logCols_audit')) || AUDIT_COLS; } catch { return AUDIT_COLS; }
  });
  const [errorCols, setErrorCols] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('logCols_error')) || ERROR_COLS; } catch { return ERROR_COLS; }
  });
  const [showColChooser, setShowColChooser] = useState(false);
  const saveCols = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  const toggleCol = (type, col) => {
    if (col === 'id' || col === 'ops') return; // always keep essential
    if (type === 'system') {
      setSystemCols(c => { const next = c.includes(col) ? c.filter(x=>x!==col) : [...c, col]; saveCols('logCols_system', next); return next; });
    } else if (type === 'audit') {
      setAuditCols(c => { const next = c.includes(col) ? c.filter(x=>x!==col) : [...c, col]; saveCols('logCols_audit', next); return next; });
    } else if (type === 'error') {
      setErrorCols(c => { const next = c.includes(col) ? c.filter(x=>x!==col) : [...c, col]; saveCols('logCols_error', next); return next; });
    }
  };
  // new row highlight tracking
  const prevMaxSystemId = useRef(0);
  const [highlightIds, setHighlightIds] = useState(new Set());

  const parsed = useMemo(()=> parseLogQuery(q || ''), [q]);
  const extraParams = useMemo(()=>{
    const p = {};
    const t = parsed.tokens || {};
    // direct mapping if present
    ['method','status_code','user_id','request_id','path','action','audit_status','error_type'].forEach(k=>{ if (t[k]) p[k] = t[k]; });
    if (parsed.ranges?.duration_ms) {
      const r = parsed.ranges.duration_ms;
      if (r['>'] || r['>=']) p.min_duration = r['>'] || r['>='];
      if (r['<'] || r['<=']) p.max_duration = r['<'] || r['<='];
    }
    return p;
  }, [parsed]);
  const { data, isLoading, error, refetch } = useLogSearch({ q: parsed.free || q, date_from: dateFrom, date_to: dateTo, types: activeTypes, limit_per_type: limitPerType, ...extraParams });
  const { data: detailData, isLoading: loadingDetail } = useSystemLogDetail(selectedSystemId);

  // auto refresh effect
  useEffect(()=>{
    if (!autoRefresh) return; 
    const id = setInterval(()=>{ refetch(); }, 8000);
    return ()=>clearInterval(id);
  }, [autoRefresh, refetch]);

  // expose parsed tokens for badge display
  const parsedTokens = parsed;

  const copy = (text) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
  };

  const system = data?.data?.system?.items || [];
  const audit = data?.data?.audit?.items || [];
  const errorLogs = data?.data?.error?.items || [];

  // update highlight on system logs
  useEffect(()=>{
    if (system.length === 0) return;
    const currentMax = Math.max(...system.map(r=>r.id));
    if (prevMaxSystemId.current === 0) { prevMaxSystemId.current = currentMax; return; }
    if (currentMax > prevMaxSystemId.current) {
      const newOnes = system.filter(r=>r.id > prevMaxSystemId.current).map(r=>r.id);
      setHighlightIds(new Set(newOnes));
      prevMaxSystemId.current = currentMax;
      // clear highlight after timeout
      setTimeout(()=> setHighlightIds(new Set()), 4000);
    }
  }, [system]);

  const toggleType = (t) => {
    setActiveTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  };

  const openRelated = async (requestId) => {
    setRequestDrawerId(requestId);
    setLoadingRelated(true);
    try { const r = await fetchRelatedLogs(requestId); setRelated(r?.data || r); } finally { setLoadingRelated(false); }
  };

  const doExport = async (fmt) => {
    const blob = await exportLogs({ q, date_from: dateFrom, date_to: dateTo, types: activeTypes, limit_per_type: limitPerType }, fmt);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logs_${Date.now()}.${fmt === 'csv' ? 'csv' : 'ndjson'}`; a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold flex items-center gap-4">
        统一日志中心
        <div className="flex gap-2 text-xs">
          <button onClick={()=>setView('table')} className={`px-2 py-1 rounded ${view==='table'?'bg-blue-600 text-white':'bg-gray-200'}`}>表格</button>
          <button onClick={()=>setView('timeline')} className={`px-2 py-1 rounded ${view==='timeline'?'bg-blue-600 text-white':'bg-gray-200'}`}>时间线</button>
            <button onClick={()=>setView('raw')} className={`px-2 py-1 rounded ${view==='raw'?'bg-blue-600 text-white':'bg-gray-200'}`}>原始</button>
        </div>
      </h1>

      <div className="flex flex-wrap gap-2 text-sm items-end">
        <div className="flex flex-col">
          <label htmlFor="log-q" className="text-xs text-gray-500">关键字 / 高级查询</label>
          <input id="log-q" value={q} onChange={e=>setQ(e.target.value)} placeholder="method:POST status:500 dur>800 action:CREATE free text" className="border p-2 rounded w-80 font-mono" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Method</label>
          <input value={extraParams.method||''} onChange={e=>setQ(prev=>mergeToken(prev,'method', e.target.value))} className="border p-2 rounded w-28 font-mono text-xs" placeholder="GET" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Status</label>
          <input value={extraParams.status_code||''} onChange={e=>setQ(prev=>mergeToken(prev,'status', e.target.value))} className="border p-2 rounded w-24 font-mono text-xs" placeholder="200" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">User ID</label>
          <input value={extraParams.user_id||''} onChange={e=>setQ(prev=>mergeToken(prev,'user', e.target.value))} className="border p-2 rounded w-24 font-mono text-xs" placeholder="123" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">ReqID</label>
          <input value={extraParams.request_id||''} onChange={e=>setQ(prev=>mergeToken(prev,'rid', e.target.value))} className="border p-2 rounded w-40 font-mono text-xs" placeholder="uuid" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Path 包含</label>
          <input value={extraParams.path||''} onChange={e=>setQ(prev=>mergeToken(prev,'path', e.target.value))} className="border p-2 rounded w-48 font-mono text-xs" placeholder="/api/v1" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">耗时 &gt;=</label>
          <input value={extraParams.min_duration||''} onChange={e=>setQ(prev=>mergeRange(prev,'dur','>', e.target.value))} className="border p-2 rounded w-24 font-mono text-xs" placeholder="ms" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">耗时 &lt;=</label>
          <input value={extraParams.max_duration||''} onChange={e=>setQ(prev=>mergeRange(prev,'dur','<', e.target.value))} className="border p-2 rounded w-24 font-mono text-xs" placeholder="ms" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Audit Action</label>
          <input value={extraParams.action||''} onChange={e=>setQ(prev=>mergeToken(prev,'action', e.target.value))} className="border p-2 rounded w-32 font-mono text-xs" placeholder="CREATE" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Audit 状态</label>
          <input value={extraParams.audit_status||''} onChange={e=>setQ(prev=>mergeToken(prev,'astatus', e.target.value))} className="border p-2 rounded w-28 font-mono text-xs" placeholder="SUCCESS" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">错误类型</label>
          <input value={extraParams.error_type||''} onChange={e=>setQ(prev=>mergeToken(prev,'etype', e.target.value))} className="border p-2 rounded w-40 font-mono text-xs" placeholder="RuntimeError" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="date-from" className="text-xs text-gray-500">起始日期</label>
          <input id="date-from" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="date-to" className="text-xs text-gray-500">结束日期</label>
          <input id="date-to" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="limit-per" className="text-xs text-gray-500">每类条数</label>
            <input id="limit-per" type="number" value={limitPerType} min={1} max={200} onChange={e=>setLimitPerType(Number(e.target.value)||50)} className="border p-2 rounded w-28" />
        </div>
        <div className="flex items-center gap-2">
          {['system','audit','error'].map(t => (
            <label key={t} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={activeTypes.includes(t)} onChange={()=>toggleType(t)} /> {t}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 pl-4 border-l ml-2 relative">
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} /> 自动刷新
          </label>
          <button onClick={()=>refetch()} className="px-2 py-1 bg-gray-200 rounded text-xs">刷新</button>
          <button onClick={()=>doExport('csv')} className="px-2 py-1 bg-gray-200 rounded text-xs">Export CSV</button>
          <button onClick={()=>doExport('ndjson')} className="px-2 py-1 bg-gray-200 rounded text-xs">Export NDJSON</button>
          <button onClick={()=>setShowColChooser(s=>!s)} className="px-2 py-1 bg-gray-200 rounded text-xs">列</button>
          {showColChooser && (
            <div className="absolute top-full right-0 mt-1 bg-white border rounded shadow-lg p-3 z-50 w-64">
              <h4 className="font-semibold text-xs mb-1">列显示 (点击切换)</h4>
              <SectionCols title="System" cols={SYSTEM_COLS} active={systemCols} onToggle={(c)=>toggleCol('system', c)} />
              <SectionCols title="Audit" cols={AUDIT_COLS} active={auditCols} onToggle={(c)=>toggleCol('audit', c)} />
              <SectionCols title="Error" cols={ERROR_COLS} active={errorCols} onToggle={(c)=>toggleCol('error', c)} />
            </div>
          )}
        </div>
      </div>

  <ActiveFilters parsed={parsedTokens} onRemove={(tokenKey)=>setQ(prev=>removeToken(prev, tokenKey))} />

      {isLoading && <div>加载中...</div>}
      {error && <div className="text-red-500">加载失败</div>}

      {view === 'table' && (
        <div className="space-y-8">
          <SystemLogSection
            title="System Logs"
            items={system}
            emptyText="无系统日志"
            columns={systemCols}
            highlightIds={highlightIds}
            onDetail={(id)=>setSelectedSystemId(id)}
            onCopyReq={copy}
            onRelated={openRelated}
          />

          <LogSection title="Audit Logs" items={audit} emptyText="无审计日志" renderItem={(log) => (
            <ExpandableRow key={`audit-${log.id}`} summaryCells={[
              log.id, log.actor_type, log.action, (log.operation_category || '-'), log.status, (log.user_id || '-'), (log.ip_address || '-'), log.created_at
            ]} detail={<AuditDetail log={log} />} />
          )} />

          <LogSection title="Error Logs" items={errorLogs} emptyText="无错误日志" renderItem={(log) => (
            <ExpandableRow key={`error-${log.id}`} summaryCells={[
              log.id, log.error_type, <span className="font-mono text-[10px] max-w-[240px] inline-block truncate" title={log.error_message}>{log.error_message}</span>, (log.error_file?.split('/').pop()), log.error_line, log.error_time
            ]} detail={<ErrorDetail log={log} />} />
          )} />
        </div>
      )}

      {view === 'timeline' && (
        <TimelineView system={system} audit={audit} error={errorLogs} onSelectRequest={openRelated} />
      )}

      {view === 'raw' && (
        <RawView system={system} audit={audit} error={errorLogs} onExportCsv={()=>doExport('csv')} onExportNdjson={()=>doExport('ndjson')} />
      )}

  {selectedSystemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded shadow-lg w-full max-w-4xl p-6 space-y-4 relative">
            <button className="absolute top-2 right-2 text-gray-500" onClick={()=>setSelectedSystemId(null)}>✕</button>
            <h2 className="text-xl font-semibold">系统日志详情 #{selectedSystemId}</h2>
            {loadingDetail && <div>加载详情...</div>}
            {detailData?.data && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Request ID:</strong> {detailData.data.request_id}</div>
                  <div><strong>Method:</strong> {detailData.data.method}</div>
                  <div className="md:col-span-2"><strong>Path:</strong> {detailData.data.path}</div>
                  <div><strong>Status:</strong> {detailData.data.status_code}</div>
                  <div><strong>User:</strong> {detailData.data.user_id || '-'}</div>
                  <div><strong>Duration:</strong> {detailData.data.duration_ms} ms</div>
                  <div className="md:col-span-2"><strong>Created:</strong> {detailData.data.created_at}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Request Body</h3>
                    <button className="text-blue-600 text-xs" onClick={()=>copy(detailData.data.request_body)}>复制</button>
                  </div>
                  <JsonTreeViewer value={safeParse(detailData.data.request_body)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Response Body</h3>
                    <button className="text-blue-600 text-xs" onClick={()=>copy(detailData.data.response_body)}>复制</button>
                  </div>
                  <JsonTreeViewer value={safeParse(detailData.data.response_body)} />
                </div>
                {detailData.data.server_meta && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Server Meta</h3>
                      <button className="text-blue-600 text-xs" onClick={()=>copy(detailData.data.server_meta)}>复制</button>
                    </div>
                    <JsonTreeViewer value={safeParse(detailData.data.server_meta)} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <RequestIdRelatedDrawer open={!!requestDrawerId} requestId={requestDrawerId} onClose={()=>setRequestDrawerId(null)} loading={loadingRelated} system={related.system} audit={related.audit} error={related.error} />
    </div>
  );
}

// Helper to merge/update a simple key:value token inside the query string
function mergeToken(prev, key, value) {
  const parts = (prev || '').split(/\s+/).filter(Boolean).filter(p=>!p.startsWith(key+':'));
  if (value) parts.push(`${key}:${value}`);
  return parts.join(' ');
}
// Helper for range tokens dur>100 etc.
function mergeRange(prev, key, op, value) {
  const regex = new RegExp(`^${key}[<>]=?|$`);
  const parts = (prev || '').split(/\s+/).filter(Boolean).filter(p=>!p.startsWith(`${key}>`) && !p.startsWith(`${key}<`) && !p.startsWith(`${key}>=`) && !p.startsWith(`${key}<=`));
  if (value) parts.push(`${key}${op}${value}`);
  return parts.join(' ');
}
function removeToken(prev, tokenKey) {
  const parts = (prev || '').split(/\s+/).filter(Boolean).filter(p=>!p.startsWith(tokenKey+':'));
  return parts.join(' ');
}

function ActiveFilters({ parsed, onRemove }) {
  const tokenEntries = Object.entries(parsed.tokens||{}).filter(([k,v])=>v && typeof v !== 'object');
  if (tokenEntries.length===0 && !parsed.free) return null;
  return (
    <div className="text-[10px] text-gray-600 flex flex-wrap gap-1">
      {tokenEntries.map(([k,v])=> (
        <span key={k} className="px-1 py-0.5 bg-gray-100 border rounded flex items-center gap-1">
          <span>{k}:{String(v)}</span>
          <button className="text-red-500" onClick={()=>onRemove(k)} title="移除">×</button>
        </span>
      ))}
      {parsed.free && <span className="px-1 py-0.5 bg-blue-50 border rounded" title="自由文本">{parsed.free}</span>}
    </div>
  );
}

function LogSection({ title, items, emptyText, renderItem }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">{title} <span className="text-xs text-gray-500">({items.length})</span></h2>
      <div className="overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              {title === 'System Logs' && <>
                <Th>ID</Th><Th>方法</Th><Th>路径</Th><Th>状态</Th><Th>用户</Th><Th>耗时</Th><Th>时间</Th><Th>操作</Th>
              </>}
              {title === 'Audit Logs' && <>
                <Th>ID</Th><Th>类型</Th><Th>Action</Th><Th>分类</Th><Th>状态</Th><Th>用户</Th><Th>IP</Th><Th>时间</Th>
              </>}
              {title === 'Error Logs' && <>
                <Th>ID</Th><Th>类型</Th><Th>信息</Th><Th>文件</Th><Th>行</Th><Th>时间</Th>
              </>}
            </tr>
          </thead>
          <tbody>
            {items.map(renderItem)}
            {items.length === 0 && (
              <tr><td colSpan={12} className="p-4 text-center text-gray-500">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }) { return <th className="p-2 text-left whitespace-nowrap">{children}</th>; }

function SectionCols({ title, cols, active, onToggle }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] font-semibold text-gray-600 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {cols.map(c => (
          <button key={c} onClick={()=>onToggle(c)} className={`text-[10px] px-1 py-0.5 border rounded ${active.includes(c)?'bg-blue-600 text-white':'bg-gray-100'}`}>{c}</button>
        ))}
      </div>
    </div>
  );
}

function SystemLogSection({ title, items, emptyText, columns, highlightIds, onDetail, onCopyReq, onRelated }) {
  const useVirtual = items.length > 120;
  const header = (
    <thead className="bg-gray-100">
      <tr>
        {columns.includes('id') && <Th>ID</Th>}
        {columns.includes('method') && <Th>方法</Th>}
        {columns.includes('path') && <Th>路径</Th>}
        {columns.includes('status_code') && <Th>状态</Th>}
        {columns.includes('user_id') && <Th>用户</Th>}
        {columns.includes('duration_ms') && <Th>耗时</Th>}
        {columns.includes('created_at') && <Th>时间</Th>}
        {columns.includes('ops') && <Th>操作</Th>}
      </tr>
    </thead>
  );
  const Row = ({ index, style }) => {
    const log = items[index];
    const hl = highlightIds.has(log.id) ? 'bg-yellow-50' : '';
    return (
      <tr key={log.id} style={style} className={`border-t hover:bg-gray-50 ${hl}`}>
        {columns.includes('id') && <td className="p-2">{log.id}</td>}
        {columns.includes('method') && <td className="p-2">{log.method}</td>}
        {columns.includes('path') && <td className="p-2 font-mono text-xs max-w-xs truncate" title={log.path}>{log.path}</td>}
        {columns.includes('status_code') && <td className="p-2">{log.status_code}</td>}
        {columns.includes('user_id') && <td className="p-2">{log.user_id || '-'}</td>}
        {columns.includes('duration_ms') && <td className="p-2">{log.duration_ms}</td>}
        {columns.includes('created_at') && <td className="p-2">{log.created_at}</td>}
        {columns.includes('ops') && (
          <td className="p-2 space-x-2">
            <button className="text-blue-600" onClick={()=>onDetail(log.id)}>详情</button>
            <button className="text-gray-600" onClick={()=>onCopyReq(log.request_id)}>复制ReqID</button>
            {log.request_id && <button className="text-indigo-600" onClick={()=>onRelated(log.request_id)}>关联</button>}
          </td>
        )}
      </tr>
    );
  };
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">{title} <span className="text-xs text-gray-500">({items.length})</span></h2>
      <div className="overflow-auto border rounded" style={{maxHeight: useVirtual ? 500 : 'auto'}}>
        <table className="w-full text-xs">
          {header}
          {!useVirtual && (
            <tbody>
              {items.map(log => Row({ index: items.indexOf(log), style: {} }))}
              {items.length === 0 && <tr><td colSpan={columns.length} className="p-4 text-center text-gray-500">{emptyText}</td></tr>}
            </tbody>
          )}
        </table>
        {useVirtual && (
          <List height={500} itemCount={items.length} itemSize={38} width="100%" className="text-xs">
            {({ index, style }) => (
              <table style={style} className="w-full border-separate border-spacing-0"><tbody>{Row({ index, style: {} })}</tbody></table>
            )}
          </List>
        )}
      </div>
    </div>
  );
}

function ExpandableRow({ summaryCells, detail }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr className={`border-t hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`}> 
        {summaryCells.map((c,i)=>(<td key={i} className="p-2 align-top">{c}</td>))}
        <td className="p-2 text-right">
          <button className="text-xs text-blue-600" onClick={()=>setOpen(o=>!o)}>{open? '收起' : '展开'}</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60">
          <td colSpan={summaryCells.length+1} className="p-3 border-t">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}

function AuditDetail({ log }) {
  return (
    <div className="space-y-2 text-xs">
      <KeyVal k="ID" v={log.id} />
      <KeyVal k="Action" v={log.action} />
      <KeyVal k="Category" v={log.operation_category || '-'} />
      <KeyVal k="Actor Type" v={log.actor_type} />
      <KeyVal k="Status" v={log.status} />
  {log.details_raw && <div><div className="font-semibold mb-1">details_raw</div><JsonTreeViewer value={safeParse(log.details_raw)} /></div>}
  {log.summary && <div><div className="font-semibold mb-1">summary</div><JsonTreeViewer value={safeParse(log.summary)} /></div>}
      {(log.old_data || log.new_data) && (
        <div className="space-y-1">
          <AuditDiffViewer oldData={log.old_data} newData={log.new_data} />
        </div>
      )}
    </div>
  );
}

function ErrorDetail({ log }) {
  return (
    <div className="space-y-2 text-xs">
      <KeyVal k="ID" v={log.id} />
      <KeyVal k="Type" v={log.error_type} />
      <KeyVal k="File" v={log.error_file} />
      <KeyVal k="Line" v={log.error_line} />
  <div><div className="font-semibold mb-1">message</div><JsonTreeViewer value={safeParse(log.error_message)} /></div>
      {log.stack_trace && <pre className="text-[10px] bg-black/80 text-green-300 p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">{log.stack_trace}</pre>}
  {log.context_json && <div><div className="font-semibold mb-1">context</div><JsonTreeViewer value={safeParse(log.context_json)} /></div>}
    </div>
  );
}

function KeyVal({ k, v }) { return <div><span className="font-semibold mr-2">{k}:</span><span className="font-mono break-all">{String(v ?? '-')}</span></div>; }
function JsonBlock() { return null; }
