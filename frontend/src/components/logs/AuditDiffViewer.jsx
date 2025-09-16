import React, { useState, useMemo } from 'react';
import JsonTreeViewer from './JsonTreeViewer';

function tryParse(v){
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return v; }
}

function buildDiff(oldVal, newVal, path = []) {
  if (Object.is(oldVal, newVal)) return [];
  const typeOld = typeof oldVal;
  const typeNew = typeof newVal;
  if (typeOld !== 'object' || typeNew !== 'object' || oldVal === null || newVal === null) {
    return [{ path: path.join('.'), old: oldVal, new: newVal }];
  }
  const keys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
  const changes = [];
  for (const k of keys) {
    changes.push(...buildDiff(oldVal[k], newVal[k], path.concat(k)));
  }
  return changes.filter(c=>!(c.old === c.new));
}

export default function AuditDiffViewer({ oldData, newData }) {
  const [mode, setMode] = useState('inline'); // inline | side | tree
  const oldParsed = useMemo(()=> tryParse(oldData), [oldData]);
  const newParsed = useMemo(()=> tryParse(newData), [newData]);
  const diff = useMemo(()=> buildDiff(oldParsed||{}, newParsed||{}), [oldParsed, newParsed]);

  return (
    <div className="border rounded bg-white text-xs">
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <strong>变更 Diff</strong>
        <div className="ml-auto flex gap-1">
          {['inline','side','tree'].map(m => (
            <button key={m} onClick={()=>setMode(m)} className={`px-2 py-0.5 rounded ${mode===m?'bg-blue-600 text-white':'bg-gray-200'}`}>{m}</button>
          ))}
        </div>
      </div>
      {mode === 'tree' && (
        <div className="grid grid-cols-2 gap-2 p-2">
          <div>
            <div className="font-semibold mb-1">旧</div>
            <JsonTreeViewer value={oldParsed} collapsed />
          </div>
          <div>
            <div className="font-semibold mb-1">新</div>
            <JsonTreeViewer value={newParsed} collapsed />
          </div>
        </div>
      )}
      {mode === 'side' && (
        <div className="p-2 overflow-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-gray-100"><th className="p-1 text-left">字段</th><th className="p-1 text-left">旧</th><th className="p-1 text-left">新</th></tr></thead>
            <tbody>
            {diff.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-gray-500">无差异</td></tr>}
            {diff.map(d => (
              <tr key={d.path} className="border-t">
                <td className="p-1 align-top font-mono">{d.path || '(root)'}</td>
                <td className="p-1 text-red-600 break-all font-mono">{JSON.stringify(d.old)}</td>
                <td className="p-1 text-green-700 break-all font-mono">{JSON.stringify(d.new)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'inline' && (
        <div className="p-2 space-y-1 max-h-80 overflow-auto">
          {diff.length === 0 && <div className="text-gray-500">无差异</div>}
          {diff.map(d => (
            <div key={d.path} className="border rounded p-1 bg-gray-50">
              <div className="font-mono text-[10px] mb-1 text-gray-600">{d.path || '(root)'}</div>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 bg-red-50 p-1 rounded"><span className="text-red-700">旧:</span> <code className="break-all">{JSON.stringify(d.old)}</code></div>
                <div className="flex-1 bg-green-50 p-1 rounded"><span className="text-green-700">新:</span> <code className="break-all">{JSON.stringify(d.new)}</code></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
