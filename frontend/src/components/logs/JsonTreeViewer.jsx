import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

function getType(val){
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

const INDENT = 14;

function Node({ data, name, path, level, collapsedDefault, search, onCopy }) {
  const type = getType(data);
  const [open, setOpen] = useState(!collapsedDefault && level < 1);
  const toggle = () => setOpen(o=>!o);
  const match = search && (String(name).toLowerCase().includes(search) || (type !== 'object' && type !== 'array' && String(data).toLowerCase().includes(search)));
  const baseStyle = match ? 'bg-yellow-100' : '';

  if (type === 'object' || type === 'array') {
    const entries = type === 'object' ? Object.entries(data || {}) : data.map((v,i)=>[i,v]);
    return (
      <div className={`font-mono text-[11px] leading-snug ${baseStyle}`}> 
        <div style={{paddingLeft: level*INDENT}} className="flex items-start gap-1">
          <button onClick={toggle} className="text-xs w-4 select-none">{open?'-':'+'}</button>
          <span className="text-blue-700">{name !== undefined ? name+':' : ''}</span>
          <span className="text-purple-600">{type === 'array' ? `Array(${entries.length})` : `Object(${entries.length})`}</span>
          <button onClick={()=>onCopy(path)} className="ml-1 text-gray-400 hover:text-gray-600" title="Copy path">📋</button>
        </div>
        {open && entries.map(([k,v]) => (
          <Node key={k} data={v} name={k} path={path.concat(k)} level={level+1} collapsedDefault={collapsedDefault} search={search} onCopy={onCopy} />
        ))}
      </div>
    );
  }
  return (
    <div style={{paddingLeft: level*INDENT}} className={`font-mono text-[11px] flex items-start gap-1 ${baseStyle}`}>
      <span className="text-blue-700">{name !== undefined ? name+':' : ''}</span>
      <span className="text-green-700 break-all">{JSON.stringify(data)}</span>
      <button onClick={()=>onCopy(path)} className="ml-1 text-gray-400 hover:text-gray-600" title="Copy path">📋</button>
      <button onClick={()=>onCopy(JSON.stringify(data))} className="ml-1 text-gray-400 hover:text-gray-600" title="Copy value">⧉</button>
    </div>
  );
}

export function JsonTreeViewer({ value, collapsed = false }) {
  const [search, setSearch] = useState('');
  const searchLower = search.trim().toLowerCase();
  const onCopy = useCallback((target)=>{
    const text = Array.isArray(target) ? '$.'+target.join('.') : target;
    navigator.clipboard.writeText(text);
  },[]);
  const data = useMemo(()=> value, [value]);
  return (
    <div className="border rounded bg-white flex flex-col h-80">
      <div className="p-1 border-b flex items-center gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search" className="text-xs border px-2 py-1 rounded w-40" />
        <span className="text-[10px] text-gray-500">{getType(data)}</span>
      </div>
      <div className="flex-1 overflow-auto p-1">
        <Node data={data} path={[]} level={0} collapsedDefault={collapsed} search={searchLower} onCopy={onCopy} />
      </div>
    </div>
  );
}

JsonTreeViewer.propTypes = {
  value: PropTypes.any,
  collapsed: PropTypes.bool
};

export default JsonTreeViewer;
