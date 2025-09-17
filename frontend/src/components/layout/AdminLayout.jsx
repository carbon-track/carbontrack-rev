import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/react-query';

export default function AdminLayout() {
  const { t } = useTranslation();

  const links = [
    { to: '/admin/dashboard', label: t('admin.tabs.dashboard') },
    { to: '/admin/users', label: t('admin.tabs.users') },
    { to: '/admin/activities', label: t('admin.tabs.activities') },
    { to: '/admin/products', label: t('admin.tabs.products') },
    { to: '/admin/badges', label: t('admin.tabs.badges', '徽章管理') },
    { to: '/admin/avatars', label: t('admin.tabs.avatars', '头像管理') },
    { to: '/admin/exchanges', label: t('admin.tabs.exchanges') },
    { to: '/admin/broadcast', label: t('admin.tabs.broadcast') },
    { to: '/admin/system-logs', label: t('admin.tabs.systemLogs') },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-6">{t('admin.title')}</h1>
      <div className="w-full overflow-x-auto mb-6">
        <nav className="inline-flex items-center gap-2 border rounded-lg p-1 bg-background">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ` +
                (isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground')
              }
              end
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </div>
  );
}
