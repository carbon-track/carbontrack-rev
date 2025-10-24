import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryClientProvider, useQuery } from 'react-query';
import { queryClient } from '../../lib/react-query';
import { Navbar } from './Navbar';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '../ui/sidebar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
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
  Clock,
  Bot,
  Loader2,
} from 'lucide-react';
import api, { adminAPI } from '../../lib/api';
import { toast } from 'react-hot-toast';

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
  const [commandQuery, setCommandQuery] = useState('');
  const [debouncedCommandQuery, setDebouncedCommandQuery] = useState('');
  const [isExecutingAiAction, setIsExecutingAiAction] = useState(false);

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
    const handler = setTimeout(() => {
      setDebouncedCommandQuery(commandQuery.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [commandQuery]);

  const activeLink = useMemo(() => {
    return translatedLinks.find((link) => location.pathname.startsWith(link.to));
  }, [location.pathname, translatedLinks]);

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery('');
      setDebouncedCommandQuery('');
    }
  }, [commandOpen]);

  const userLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN';

  const aiContext = useMemo(() => ({
    activeRoute: location.pathname,
    locale: userLocale,
  }), [location.pathname, userLocale]);

  const shouldFetchAi = commandOpen && debouncedCommandQuery.length >= 4;

  const {
    data: aiData,
    isFetching: isFetchingAi,
    isError: isAiError,
    error: aiError,
  } = useQuery(
    ['admin-ai-intent', debouncedCommandQuery, aiContext.activeRoute, aiContext.locale],
    async () => {
      const response = await adminAPI.analyzeCommand({
        query: debouncedCommandQuery,
        context: aiContext,
        mode: 'suggest',
      });
      return response.data;
    },
    {
      enabled: shouldFetchAi,
      staleTime: 30000,
      cacheTime: 60000,
      retry: false,
    }
  );

  const aiIntent = aiData?.intent ?? null;
  const aiAlternatives = aiData?.alternatives ?? [];
  const aiErrorMessage = useMemo(() => {
    if (!isAiError || !aiError) {
      return null;
    }
    const message = aiError?.response?.data?.error;
    if (message) {
      return message;
    }
    return t('admin.command.aiError', '�޷���ȡAI����');
  }, [aiError, isAiError, t]);

  const showAiSection = commandQuery.trim().length > 0 && (
    isFetchingAi || aiIntent || aiAlternatives.length > 0 || isAiError
  );

  const buildRouteWithQuery = useCallback((route, query = {}) => {
    if (!route) {
      return null;
    }
    const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (entries.length === 0) {
      return route;
    }
    const params = new URLSearchParams();
    entries.forEach(([key, value]) => {
      params.set(key, String(value));
    });
    return `${route}?${params.toString()}`;
  }, []);

  const handleAiIntentSelect = useCallback(async (intent) => {
    if (!intent || isExecutingAiAction) {
      return;
    }

    if (intent.type === 'navigate' || intent.type === 'quick_action') {
      const targetRoute = intent?.target?.route;
      if (!targetRoute) {
        toast.error(t('admin.command.aiMissingRoute', 'δ�ҵ�����תҳ��'));
        return;
      }
      const fullRoute = buildRouteWithQuery(targetRoute, intent?.target?.query || {});
      setCommandOpen(false);
      setCommandQuery('');
      navigate(fullRoute || targetRoute);
      return;
    }

    if (intent.type === 'action' && intent.action) {
      const missing = Array.isArray(intent.missing) ? intent.missing : [];
      if (missing.length > 0) {
        toast.error(missing[0]?.description || t('admin.command.aiMissingInfo', '�����������Ϣ�ټ���'));
        return;
      }

      const apiConfig = intent.action.api || {};
      let path = apiConfig.path || '';
      if (!path) {
        toast.error(t('admin.command.aiMissingPath', 'ȱ����ִ�еĽӿڵ�ַ'));
        return;
      }
      const method = (apiConfig.method || 'post').toLowerCase();
      if (path.startsWith('/api/v1')) {
        path = path.replace('/api/v1', '') || '/';
      }

      const payload = apiConfig.payload || {};
      const requestConfig = {
        method,
        url: path,
      };
      if (method === 'get' || method === 'delete') {
        requestConfig.params = payload;
      } else {
        requestConfig.data = payload;
      }

      try {
        setIsExecutingAiAction(true);
        await api.request(requestConfig);
        toast.success(t('admin.command.aiActionSuccess', 'ָ����ִ��'));
        setCommandQuery('');
        setCommandOpen(false);
      } catch (error) {
        const requestId = error?.response?.data?.request_id;
        let message = t('admin.command.aiActionFailed', 'ָ��ִ��ʧ��');
        if (requestId) {
          message += ` (ReqID: ${requestId})`;
        }
        toast.error(message);
      } finally {
        setIsExecutingAiAction(false);
      }
      return;
    }

    toast(t('admin.command.aiNoMatch', '��ʱ�޷����˴�ָ��'), { icon: '🤖' });
  }, [buildRouteWithQuery, isExecutingAiAction, navigate, setCommandOpen, setCommandQuery, t]);

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

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <Navbar />
        <SidebarProvider>
          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <CommandInput
              value={commandQuery}
              onValueChange={setCommandQuery}
              placeholder={t('admin.command.placeholder', '������ת��ִ�в���')}
            />

            <CommandList>
              <CommandEmpty>{t('admin.command.noResults', 'û��ƥ��Ľ��')}</CommandEmpty>
              {showAiSection && (
                <CommandGroup heading={t('admin.command.aiSuggestions', 'AI �Ƽ�')}>
                  {isFetchingAi && (
                    <CommandItem value="ai-loading" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('admin.command.aiLoading', 'AI ����������ָ��...')}</span>
                    </CommandItem>
                  )}
                  {!isFetchingAi && isAiError && (
                    <CommandItem value="ai-error" disabled>
                      <Bot className="h-4 w-4 text-rose-500" />
                      <div className="flex flex-col">
                        <span>{aiErrorMessage || t('admin.command.aiError', '�޷���ȡAI����')}</span>
                        {aiError?.response?.data?.code && (
                          <span className="text-xs text-muted-foreground">{aiError.response.data.code}</span>
                        )}
                      </div>
                    </CommandItem>
                  )}
                  {!isFetchingAi && !isAiError && aiIntent && (
                    <CommandItem
                      value={aiIntent.label || 'AI suggestion'}
                      onSelect={() => handleAiIntentSelect(aiIntent)}
                      disabled={isExecutingAiAction && aiIntent.type === 'action'}
                    >
                      <Bot className="h-4 w-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span>{aiIntent.label}</span>
                        {aiIntent.reasoning && (
                          <span className="text-xs text-muted-foreground">{aiIntent.reasoning}</span>
                        )}
                      </div>
                      {aiIntent.type === 'action' && (
                        <span className="ml-auto text-xs text-emerald-600">
                          {t('admin.command.aiExecute', 'ִ��')}
                        </span>
                      )}
                    </CommandItem>
                  )}
                  {!isFetchingAi && !isAiError && aiAlternatives.map((alt, index) => (
                    <CommandItem
                      key={`ai-alt-${index}-${alt.label || alt.type}`}
                      value={alt.label || `AI option ${index + 1}`}
                      onSelect={() => handleAiIntentSelect(alt)}
                      disabled={isExecutingAiAction && alt.type === 'action'}
                    >
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span>{alt.label}</span>
                        {alt.reasoning && (
                          <span className="text-xs text-muted-foreground">{alt.reasoning}</span>
                        )}
                      </div>
                      {alt.type === 'action' && (
                        <span className="ml-auto text-xs text-emerald-600">
                          {t('admin.command.aiExecute', 'ִ��')}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading={t('admin.command.navigation', '���浼��')}>

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
          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)]" />
            <div className="flex flex-1">
              <Sidebar className="border-r border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
                <SidebarHeader className="px-5 py-6">
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/80 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                    {t('admin.title')}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    {t('admin.subtitle', '集中管理CarbonTrack的一切')}
                  </p>
                </SidebarHeader>
                <SidebarContent className="px-3 py-4">
                  <SidebarMenu className="gap-1.5">
                    {translatedLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = location.pathname.startsWith(link.to);
                      return (
                        <SidebarMenuItem key={link.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={link.label}
                            size="lg"
                            variant="outline"
                            className={cn(
                              'group justify-start rounded-2xl border border-transparent bg-transparent transition-all duration-150 hover:border-emerald-100 hover:bg-emerald-50/60',
                              isActive && 'border-emerald-200 bg-emerald-50/80 text-emerald-700 shadow-sm'
                            )}
                          >
                            <NavLink
                              to={link.to}
                              className={({ isActive: navIsActive }) =>
                                cn(
                                  'flex w-full items-center gap-3 text-sm font-medium text-slate-600 transition-colors',
                                  (isActive || navIsActive) && 'text-emerald-700'
                                )
                              }
                            >
                              <span
                                className={cn(
                                  'flex h-10 w-10 items-center justify-center rounded-xl border border-transparent bg-slate-50 text-emerald-600 transition-all group-hover:border-emerald-100 group-hover:bg-emerald-50',
                                  isActive && 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{link.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="px-5 pb-6 pt-0">
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm">
                    <Sparkles className="mt-1 h-4 w-4 text-emerald-500" />
                    <p className="text-xs leading-relaxed text-slate-600">
                      {t('admin.footer.tip', '提示：使用 Ctrl + K 调出指挥面板')}
                    </p>
                  </div>
                </SidebarFooter>
              </Sidebar>
              <SidebarInset className="relative flex flex-1 flex-col bg-transparent">
                <header className=" top-16 z-30 flex flex-col gap-5 border-b border-transparent px-6 pt-6 pb-4 md:px-10">
                  <div className="flex flex-wrap items-center gap-4">
                    <SidebarTrigger className="md:hidden" />
                    <div className="flex flex-col gap-2">
                      <Badge variant="outline" className="w-fit rounded-full border-emerald-200 bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-600">
                        {t('admin.header.section', '当前板块')}
                      </Badge>
                      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{activeLink?.label}</h1>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="hidden items-center gap-2 rounded-full border-emerald-200 bg-white/80 px-4 md:inline-flex"
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
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4"
                        onClick={() => navigate('/admin/badges?create=1')}
                      >
                        <Award className="h-4 w-4" />
                        {t('admin.header.quickBadge', '快速创建徽章')}
                      </Button>
                    </div>
                  </div>
                </header>
                <main className="px-6 pb-10 pt-6 md:px-10">
                  <div className="mx-auto w-full max-w-7xl space-y-6">
                    <Outlet />
                  </div>
                </main>
              </SidebarInset>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </QueryClientProvider>
  );

}


