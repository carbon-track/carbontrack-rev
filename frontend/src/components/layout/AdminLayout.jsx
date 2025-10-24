import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryClientProvider, useQuery, useMutation } from 'react-query';
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
import { Separator } from '../ui/separator';
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
  Stethoscope,
  Sparkles,
  ShieldCheck,
  Bot,
  Loader2,
} from 'lucide-react';
import api, { adminAPI } from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

const COMMAND_MIN_LENGTH = 2;
const MAX_SESSIONS = 8;

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
  { key: 'diagnostics', to: '/admin/diagnostics', icon: Stethoscope },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [debouncedCommandQuery, setDebouncedCommandQuery] = useState('');
  const [isExecutingAiAction, setIsExecutingAiAction] = useState(false);
  const [aiSessions, setAiSessions] = useState([]);

  const lastAiSignatureRef = useRef('');

  const translatedLinks = useMemo(() => {
    const fallbackLabels = {
      dashboard: '管理总览',
      users: '用户管理',
      activities: '碳活动管理',
      products: '兑换商品',
      badges: '徽章管理',
      avatars: '头像管理',
      exchanges: '积分兑换',
      broadcast: '公告广播',
      systemLogs: '系统日志',
      diagnostics: 'AI 诊断',
    };

    return NAV_LINKS.map((link) => ({
      ...link,
      label: t(`admin.nav.${link.key}`, fallbackLabels[link.key] || link.key),
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
  ]), [navigate, setCommandOpen, t]);

  const getTapHint = useCallback((intentType) => {
    switch (intentType) {
      case 'action':
        return t('admin.command.aiTapToRun', '点击执行此操作');
      case 'quick_action':
        return t('admin.command.aiTapQuick', '点击执行快捷操作');
      default:
        return t('admin.command.aiTapToOpen', '点击前往该位置');
    }
  }, [t]);

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

  const aiErrorMessage = useMemo(() => {
    if (!isAiError || !aiError) {
      return null;
    }
    const message = aiError?.response?.data?.error;
    if (message) {
      return message;
    }
    return t('admin.command.aiError', '无法获取 AI 响应');
  }, [aiError, isAiError, t]);

  useEffect(() => {
    if (!commandOpen) {
      setAiSessions([]);
      lastAiSignatureRef.current = '';
    }
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen) {
      return;
    }
    if (debouncedCommandQuery.length < 4) {
      return;
    }
    if (isFetchingAi) {
      return;
    }
    if (!aiData && !isAiError) {
      return;
    }

    const normalizedQuery = debouncedCommandQuery;
    const alternatives = Array.isArray(aiData?.alternatives) ? aiData.alternatives : [];
    const sessionPayload = {
      query: normalizedQuery,
      route: aiContext.activeRoute,
      intent: aiData?.intent ?? null,
      alternatives,
      error: isAiError ? (aiErrorMessage || '无法获取 AI 响应') : null,
      errorCode: isAiError ? aiError?.response?.data?.code ?? null : null,
      timestamp: Date.now(),
    };

    if (!sessionPayload.intent && sessionPayload.alternatives.length === 0 && !sessionPayload.error) {
      return;
    }

    const signature = [
      normalizedQuery,
      aiContext.activeRoute,
      sessionPayload.intent?.type || '',
      sessionPayload.intent?.label || '',
      sessionPayload.error || '',
      sessionPayload.alternatives.map((alt) => `${alt.type || ''}:${alt.label || alt.type || ''}`).join('|'),
      sessionPayload.errorCode || '',
    ].join('::');

    if (signature === lastAiSignatureRef.current) {
      return;
    }

    setAiSessions((prev) => {
      const existingIndex = prev.findIndex(
        (session) => session.query === normalizedQuery && session.route === aiContext.activeRoute
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          intent: sessionPayload.intent,
          alternatives: sessionPayload.alternatives,
          error: sessionPayload.error,
          errorCode: sessionPayload.errorCode,
          timestamp: sessionPayload.timestamp,
        };
        return next;
      }

      const newSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...sessionPayload,
      };
      const trimmed = [...prev, newSession];
      return trimmed.length > 5 ? trimmed.slice(-5) : trimmed;
    });

    lastAiSignatureRef.current = signature;
  }, [aiData, aiContext.activeRoute, aiError, aiErrorMessage, commandOpen, debouncedCommandQuery, isAiError, isFetchingAi]);

  const showAiSection = commandQuery.trim().length > 0 && (isFetchingAi || aiSessions.length > 0);

  const buildRouteWithQuery = useCallback((route, query = {}) => {
    if (!route) {
      return null;
    }
    const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (entries.length === 0) {
      return route;
    }
    const params = new URLSearchParams();
    for (const [key, value] of entries) {
      params.set(key, String(value));
    }
    return `${route}?${params.toString()}`;
  }, []);

  const handleNavigationIntent = useCallback((intent) => {
    const targetRoute = intent?.target?.route;
    if (!targetRoute) {
      toast.error(t('admin.command.aiMissingRoute', '未找到目标跳转页面'));
      return;
    }
    const fullRoute = buildRouteWithQuery(targetRoute, intent?.target?.query || {});
    setCommandOpen(false);
    setCommandQuery('');
    navigate(fullRoute || targetRoute);
  }, [buildRouteWithQuery, navigate, setCommandOpen, setCommandQuery, t]);

  const executeIntentAction = useCallback(async (intent) => {
    const missing = Array.isArray(intent.missing) ? intent.missing : [];
    if (missing.length > 0) {
      toast.error(missing[0]?.description || t('admin.command.aiMissingInfo', '请补充必要信息后再试'));
      return;
    }

    const apiConfig = intent.action?.api || {};
    let path = apiConfig.path || '';
    if (!path) {
      toast.error(t('admin.command.aiMissingPath', '缺少要执行的接口地址'));
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
      toast.success(t('admin.command.aiActionSuccess', '指令已执行'));
      setCommandQuery('');
      setCommandOpen(false);
    } catch (error) {
      const requestId = error?.response?.data?.request_id;
      let message = t('admin.command.aiActionFailed', '指令执行失败');
      if (requestId) {
        message += ` (ReqID: ${requestId})`;
      }
      toast.error(message);
    } finally {
      setIsExecutingAiAction(false);
    }
  }, [setCommandOpen, setCommandQuery, setIsExecutingAiAction, t]);

  const handleAiIntentSelect = useCallback(async (intent) => {
    if (!intent || isExecutingAiAction) {
      return;
    }

    if (intent.type === 'navigate' || intent.type === 'quick_action') {
      handleNavigationIntent(intent);
      return;
    }

    if (intent.type === 'action' && intent.action) {
      await executeIntentAction(intent);
      return;
    }

    toast(t('admin.command.aiNoMatch', '暂时无法理解该指令'), { icon: '🤖' });
  }, [executeIntentAction, handleNavigationIntent, isExecutingAiAction, t]);

  useEffect(() => {
    const target = typeof globalThis !== 'undefined' ? globalThis : undefined;
    if (!target?.addEventListener) {
      return undefined;
    }

    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
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
              placeholder={t('admin.command.placeholder', '输入命令以跳转或执行操作')}
            />

            <CommandList>
              <CommandEmpty>{t('admin.command.noResults', '没有匹配的结果')}</CommandEmpty>
              <div className="px-4 py-2 text-xs text-muted-foreground">
                {t('admin.command.hint', '提示：直接在上方输入自然语言命令，AI 会结合当前页面给出建议。')}
              </div>
              {showAiSection && (
                <CommandGroup heading={t('admin.command.aiConversation', 'AI 对话')}>
                  <div className="flex flex-col gap-3 py-1">
                    {aiSessions.map((session) => (
                      <React.Fragment key={session.id}>
                        <CommandItem
                          value={`user-${session.id}`}
                          disabled
                          className="pointer-events-none items-start gap-3 rounded-2xl bg-transparent px-0 py-0"
                        >
                          <span className="mt-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {t('admin.command.userLabel', '你')}
                          </span>
                          <div className="max-w-full rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700 shadow-sm">
                            {session.query}
                          </div>
                        </CommandItem>
                        {session.error ? (
                          <CommandItem
                            value={`ai-error-${session.id}`}
                            disabled
                            className="pointer-events-none items-start gap-3 rounded-2xl bg-transparent px-0 py-0"
                          >
                            <span className="mt-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                              {t('admin.command.aiLabel', '助手')}
                            </span>
                            <div className="flex w-full flex-col gap-1 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600 shadow-sm">
                              <span>{session.error}</span>
                              {session.errorCode && (
                                <span className="text-xs text-rose-500/80">
                                  {t('admin.command.aiErrorCode', '错误代码')}：{session.errorCode}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ) : (
                          <React.Fragment>
                            {session.intent && (
                              <CommandItem
                                value={`ai-intent-${session.id}`}
                                onSelect={() => handleAiIntentSelect(session.intent)}
                                disabled={isExecutingAiAction && session.intent.type === 'action'}
                                className="items-start gap-3 rounded-2xl bg-transparent px-0 py-0"
                              >
                                <span className="mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  {t('admin.command.aiLabel', '助手')}
                                </span>
                                <div className="flex w-full flex-col gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow-sm">
                                  <span className="font-medium">{session.intent.label || t('admin.command.aiSuggestionFallback', '智能建议')}</span>
                                  {session.intent.reasoning && (
                                    <span className="text-xs text-emerald-700">{session.intent.reasoning}</span>
                                  )}
                                  <span className="self-start rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                                    {getTapHint(session.intent.type)}
                                  </span>
                                </div>
                              </CommandItem>
                            )}
                            {session.alternatives.map((alt, index) => (
                              <CommandItem
                                key={`ai-alt-${session.id}-${index}`}
                                value={alt.label || `AI option ${index + 1}`}
                                onSelect={() => handleAiIntentSelect(alt)}
                                disabled={isExecutingAiAction && alt.type === 'action'}
                                className="items-start gap-3 rounded-2xl bg-transparent px-0 py-0"
                              >
                                <span className="mt-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                  {t('admin.command.aiLabel', '助手')}
                                </span>
                                <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-emerald-500" />
                                    <span className="font-medium">{alt.label || t('admin.command.aiAlternativeFallback', '可选方案')}</span>
                                  </div>
                                  {alt.reasoning && (
                                    <span className="text-xs text-muted-foreground">{alt.reasoning}</span>
                                  )}
                                  <span className="self-start rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {getTapHint(alt.type)}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </React.Fragment>
                        )}
                      </React.Fragment>
                    ))}
                    {isFetchingAi && (
                      <CommandItem
                        value="ai-loading"
                        disabled
                        className="pointer-events-none items-start gap-3 rounded-2xl bg-transparent px-0 py-0"
                      >
                        <span className="mt-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {t('admin.command.aiLabel', '助手')}
                        </span>
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600 shadow-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{t('admin.command.aiLoading', 'AI 正在分析指令...')}</span>
                        </div>
                      </CommandItem>
                    )}
                  </div>
                </CommandGroup>
              )}
              <CommandGroup heading={t('admin.command.navigation', '导航菜单')}>
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
                        <Bot className="h-4 w-4" />
                        {t('admin.command.open', '打开 AI 面板 / Ctrl + K')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="md:hidden"
                        onClick={() => setCommandOpen(true)}
                      >
                        <Bot className="h-4 w-4" />
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


