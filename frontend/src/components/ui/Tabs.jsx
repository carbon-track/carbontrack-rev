import React, { useState } from 'react';

export function Tabs({ children, value, onValueChange, className = '' }) {
  const [internal, setInternal] = useState(value || '');
  const active = value !== undefined ? value : internal;
  const setActive = (v) => {
    if (onValueChange) onValueChange(v);
    if (value === undefined) setInternal(v);
  };

  return (
    <div className={className} data-tabs>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type === TabsList) {
          return React.cloneElement(child, { active, setActive });
        }
        if (child.type === TabsContent) {
          return React.cloneElement(child, { active });
        }
        return child;
      })}
    </div>
  );
}

export function TabsList({ children, active, setActive, className = '' }) {
  return (
    <div className={`inline-flex rounded-md border bg-white ${className}`} role="tablist">
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { active, setActive });
      })}
    </div>
  );
}

export function TabsTrigger({ value, children, active, setActive, className = '' }) {
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={`px-3 py-2 text-sm border-r last:border-r-0 ${isActive ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children, className = '' }) {
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}

