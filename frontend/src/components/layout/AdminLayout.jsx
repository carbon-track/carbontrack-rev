import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryClientProvider } from 'react-query';
import { queryClient } from '../../lib/react-query';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
} from '../ui/sidebar';
import { Button } from '../ui/Button';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '../ui/command';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  Leaf,
  Award,
  PackageCheck,
  UserCircle2,
  Repeat2,
  Radio,
  ScrollText,
  Search,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const NAV_LINKS = [
  { key: 'dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'users', to: '/admin/users', icon: Users },
  { key: 'activities', to: '/admin/activities', icon: Leaf },
  { key: 'products', to: '/admin/products', icon: PackageCheck },
  { key: 'badges', to: '/admin/badges', icon: Award },
  { key: 'avatars', to: '/admin/avatars', icon: UserCircle2 },
  { key: 'exchanges', to: '/admin/exchanges', icon: Repeat2 },
  { key: 'broadcast', to: '/admin/broadcast', icon: Radio },
  { key: 'systemLogs', to: '/admin/system-logs', icon: ScrollText },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);

  const translatedLinks = useMemo(() => {
    return NAV_LINKS.map((link) => ({
      ...link,
      label: t(['admin', 'tabs', link.key].join('.'), link.key),
    }));
  }, [t]);

  const quickActions = useMemo(() => ([
    {
      id: 'search-users',
      label: t('admin.command.searchUsers', '搜索用户'),
      description: t('admin.command.searchUsersHint', '打开用户管理并聚焦搜索框'),
      shortcut: 'U',
      onSelect: () => {
        navigate('/admin/users?focus=search');
        setCommandOpen(false);
      },
    },
    {
      id: 'create-badge',
      label: t('admin.command.createBadge', '创建新徽章'),
      description: t('admin.command.createBadgeHint', '跳转到徽章管理并开启新建模式'),
      shortcut: 'B',
      onSelect: () => {
        navigate('/admin/badges?create=1');
        setCommandOpen(false);
      },
    },
    {
      id: 'review-activities',
      label: t('admin.command.reviewActivities', '待审核活动'),
      description: t('admin.command.reviewActivitiesHint', '查看并处理碳减排活动审核'),
      shortcut: 'A',
      onSelect: () => {
        navigate('/admin/activities?filter=pending');
        setCommandOpen(false);
      },
    },
    {
      id: 'broadcast',
      label: t('admin.command.sendBroadcast', '发布平台公告'),
      description: t('admin.command.sendBroadcastHint', '打开广播中心发送新公告'),
      shortcut: 'N',
      onSelect: () => {
        navigate('/admin/broadcast?compose=1');
        setCommandOpen(false);
      },
    },
  ]), [navigate, t]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeLink = translatedLinks.find((link) => location.pathname.startsWith(link.to)) || translatedLinks[0];

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder={t('admin.command.placeholder', '快速跳转或执行操作')} />
          <CommandList>
            <CommandEmpty>{t('admin.command.noResults', '没有匹配的结果')}</CommandEmpty>
            <CommandGroup heading={t('admin.command.navigation', '界面导航')}>
              {translatedLinks.map((link) => (
                <CommandItem
                  key={link.to}
                  value={link.label}
                  onSelect={() => {
                    navigate(link.to);
                    setCommandOpen(false);
                  }}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t('admin.command.quickActions', '快捷操作')}>
              {quickActions.map((action) => (
                <CommandItem key={action.id} value={action.label} onSelect={action.onSelect}>
                  <Sparkles className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.description}</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{action.shortcut}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <div className="flex min-h-screen bg-muted/40">
          <Sidebar>
            <SidebarHeader className="px-4 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                {t('admin.title')}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.subtitle', '集中管理 CarbonTrack 平台的一切')}
              </p>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent>
              <SidebarMenu>
                {translatedLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname.startsWith(link.to);
                  return (
                    <SidebarMenuItem key={link.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={link.label}
                        className="justify-start"
                      >
                        <NavLink to={link.to} className={({ isActive: navIsActive }) =>
                          cn('flex items-center gap-3 text-sm', (isActive || navIsActive) && 'font-semibold')
                        }>
                          <Icon className="h-4 w-4" />
                          <span>{link.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="px-4 py-4 text-xs text-muted-foreground">
              <p>{t('admin.footer.tip', '提示：使用 Ctrl + K 调出指挥面板')}</p>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset>
            <header className="sticky top-0 z-30 flex flex-col border-b bg-background/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/50">
              <div className="flex flex-wrap items-center gap-3">
                <SidebarTrigger className="md:hidden" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('admin.header.section', '当前板块')}</p>
                  <h1 className="text-2xl font-semibold leading-tight">{activeLink?.label}</h1>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="hidden md:inline-flex items-center gap-2"
                    onClick={() => setCommandOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                    {t('admin.command.open', '搜索 / Ctrl + K')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="md:hidden"
                    onClick={() => setCommandOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    className="inline-flex items-center gap-2"
                    onClick={() => navigate('/admin/badges?create=1')}
                  >
                    <Award className="h-4 w-4" />
                    {t('admin.header.quickBadge', '快速创建徽章')}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="font-medium text-foreground">{t('admin.header.quickActions', '常用操作')}</p>
                  <p>{t('admin.header.quickActionsHint', '在指挥面板中聚合所有常用入口')}</p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="font-medium text-foreground">{t('admin.header.pending', '待处理提醒')}</p>
                  <p>{t('admin.header.pendingHint', '各模块会在自己的页面提示待处理数量')}</p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="font-medium text-foreground">{t('admin.header.security', '安全状态')}</p>
                  <p>{t('admin.header.securityHint', '请确保仅管理员访问该后台')}</p>
                </div>
              </div>
            </header>

            <main className="px-6 py-6">
              <div className="mx-auto w-full max-w-7xl">
                <Outlet />
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
