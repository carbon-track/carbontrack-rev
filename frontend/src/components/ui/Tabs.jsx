import React, { useState } from 'react';

function getTabIds(tabsId, value) {
  const suffix = encodeURIComponent(String(value));
  return {
    triggerId: `${tabsId}-trigger-${suffix}`,
    panelId: `${tabsId}-panel-${suffix}`,
  };
}

export function Tabs({ children, value, onValueChange, className = '', idBase }) {
  const [internal, setInternal] = useState(value || '');
  const generatedId = React.useId();
  const tabsId = idBase || generatedId;
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
          return React.cloneElement(child, { active, setActive, tabsId });
        }
        if (child.type === TabsContent) {
          return React.cloneElement(child, { active, tabsId });
        }
        return child;
      })}
    </div>
  );
}

export function TabsList({ children, active, setActive, tabsId, className = '' }) {
  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]:not([disabled])'));
    const activeElement = event.currentTarget.ownerDocument.activeElement;
    const activeTab = activeElement?.closest?.('[role="tab"]');
    const currentIndex = tabs.indexOf(activeTab);
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
        return React.cloneElement(child, { active, setActive, tabsId });
      })}
    </div>
  );
}

export function TabsTrigger({ value, children, active, setActive, tabsId, className = '' }) {
  const isActive = active === value;
  const { triggerId, panelId } = getTabIds(tabsId, value);
  return (
    <button
      type="button"
      role="tab"
      id={triggerId}
      aria-controls={panelId}
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

export function TabsContent({ value, active, children, tabsId, className = '' }) {
  const isActive = active === value;
  const { triggerId, panelId } = getTabIds(tabsId, value);
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={triggerId}
      tabIndex={isActive ? 0 : -1}
      hidden={!isActive}
      className={className}
    >
      {isActive ? children : null}
    </div>
  );
}
