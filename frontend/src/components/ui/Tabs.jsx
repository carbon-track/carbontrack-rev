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
  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]:not([disabled])'));
    const currentIndex = tabs.indexOf(event.currentTarget.ownerDocument.activeElement);
    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      className={`inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-border bg-card ${className}`}
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
    >
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
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActive(value)}
      className={`shrink-0 border-r border-border px-3 py-2 text-sm text-foreground last:border-r-0 ${isActive ? 'bg-muted font-semibold' : 'hover:bg-muted/60'} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children, className = '' }) {
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
