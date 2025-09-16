import React from 'react';
import PropTypes from 'prop-types';

export default function RawView({ system = [], audit = [], error = [], onExportCsv, onExportNdjson }) {
  const merged = [
    ...system.map(r=>({...r, __type:'system'})),
    ...audit.map(r=>({...r, __type:'audit'})),
    ...error.map(r=>({...r, __type:'error'})),
  ].sort((a,b)=>{
    const ta = Date.parse(a.created_at || a.error_time || a.time || a.timestamp || 0) || 0;
    const tb = Date.parse(b.created_at || b.error_time || b.time || b.timestamp || 0) || 0;
    return tb - ta;
  }).slice(0,1000);

  const ndjson = merged.map(o=>JSON.stringify(o)).join('\n');

  const copyAll = () => {
    navigator.clipboard.writeText(ndjson).catch(()=>{});
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        <button className="px-2 py-1 bg-gray-200 rounded" onClick={copyAll}>Copy NDJSON</button>
        <button className="px-2 py-1 bg-gray-200 rounded" onClick={onExportNdjson}>Export NDJSON</button>
        <button className="px-2 py-1 bg-gray-200 rounded" onClick={onExportCsv}>Export CSV</button>
        <div className="text-gray-500 self-center">{merged.length} records (max 1000)</div>
      </div>
      <pre className="text-[10px] leading-tight bg-black text-green-300 p-3 rounded overflow-auto max-h-[60vh] whitespace-pre">{ndjson}</pre>
    </div>
  );
}

RawView.propTypes = {
  system: PropTypes.array,
  audit: PropTypes.array,
  error: PropTypes.array,
  onExportCsv: PropTypes.func,
  onExportNdjson: PropTypes.func
};
