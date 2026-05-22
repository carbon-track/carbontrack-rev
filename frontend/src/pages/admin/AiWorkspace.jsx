import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Clock3,
  Command,
  Cpu,
  ExternalLink,
  Filter,
  History,
  Loader2,
  Search,
  ShieldCheck,
  TerminalSquare,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminAPI, streamApiRequest } from '../../lib/api';
import { userManager } from '../../lib/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import AdminAiMarkdown from '../../components/admin/AdminAiMarkdown';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';

const COMMAND_MIN_LENGTH = 2;
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const MAX_STREAM_ITEMS = 120;
const CURRENT_CONVERSATION_POLL_INTERVAL_MS = 10000;

function trimStreamItems(items) {
  return items.length > MAX_STREAM_ITEMS ? items.slice(-MAX_STREAM_ITEMS) : items;
}

function createEmptyStreamState() {
  return {
    optimisticMessage: null,
    items: [],
  };
}

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || null;
}

function isActiveStreamItem(item) {
  if (item?.kind === 'assistant_stream') {
    return item.data?.streaming !== false;
  }
  if (item?.kind === 'stream_status') {
    return !['finished', 'error'].includes(item.data?.status);
  }
  if (item?.kind === 'stream_tool') {
    return ['running', 'waiting_input', 'waiting_approval'].includes(item.data?.status);
  }
  return false;
}

function preserveStreamDiagnosticsAfterError(state, error) {
  const errorMessage = getErrorMessage(error);
  const items = Array.isArray(state.items) ? state.items : [];

  return {
    ...state,
    optimisticMessage: null,
    items: items.map((item) => {
      if (item?.kind === 'assistant_stream') {
        return { ...item, data: { ...(item.data || {}), streaming: false } };
      }
      if (item?.kind === 'stream_status' && !['finished', 'error'].includes(item.data?.status)) {
        return {
          ...item,
          event: 'run.error',
          data: { ...(item.data || {}), status: 'error', error: item.data?.error || errorMessage },
        };
      }
      if (item?.kind === 'stream_tool' && ['running', 'waiting_input', 'waiting_approval'].includes(item.data?.status)) {
        return {
          ...item,
          event: 'tool.error',
          data: { ...(item.data || {}), status: 'error', error: item.data?.error || errorMessage },
        };
      }
      return item;
    }),
  };
}

async function streamAdminAiChat(payload, onEvent) {
  const response = await streamApiRequest('/admin/ai/chat/stream', {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
    },
    body: payload,
  });

  const contentType = response.headers.get('content-type') || '';
  if (response.status === 401) {
    const error = new Error('Unauthorized');
    error.code = 'UNAUTHORIZED';
    error.response = {
      status: response.status,
      data: null,
      headers: { 'content-type': contentType },
    };
    throw error;
  }

  if (!response.ok || !response.body || !contentType.includes('text/event-stream')) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = null;
    }
    const error = new Error(errorPayload?.error || `AI stream failed with status ${response.status}`);
    error.code = errorPayload?.code || 'AI_STREAM_FAILED';
    error.response = {
      status: response.status,
      data: errorPayload,
      headers: { 'content-type': contentType },
    };
    throw error;
  }

  const decoder = new TextDecoder('utf-8');
  const reader = response.body.getReader();
  let buffer = '';
  let finalPayload = null;

  const dispatchFrame = (frame) => {
    const lines = frame.split(/\r?\n/);
    let event = 'message';
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return;

    let data = null;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = { raw: dataLines.join('\n') };
    }

    onEvent?.({ event, data });
    if (event === 'run.finished' && data?.result) {
      finalPayload = data.result;
    }
    if (event === 'run.error') {
      const error = new Error(data?.error || 'AI stream failed');
      error.code = data?.code || 'AI_STREAM_FAILED';
      error.response = { data };
      error.streamEvent = data;
      throw error;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let separatorMatch = buffer.match(/\r?\n\r?\n/);
      let separatorIndex = separatorMatch?.index ?? -1;
      while (separatorIndex !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + separatorMatch[0].length);
        dispatchFrame(frame);
        separatorMatch = buffer.match(/\r?\n\r?\n/);
        separatorIndex = separatorMatch?.index ?? -1;
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      dispatchFrame(tail);
    }

    if (!finalPayload) {
      const error = new Error('AI stream ended before the run finished.');
      error.code = 'AI_STREAM_DISCONNECTED';
      throw error;
    }

    return finalPayload;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cleanup failures so the original stream result is preserved.
    }
  }
}
const ROUTE_COPY = {
  dashboard: {
    zh: { label: '管理总览', description: '后台总览、关键指标与快捷处理入口。' },
    en: { label: 'Admin dashboard', description: 'Overview, key metrics, and quick admin tasks.' },
  },
  passkeys: {
    zh: { label: '通行密钥', description: '查看已注册通行密钥、备份状态与最近登录活动。' },
    en: { label: 'Passkeys', description: 'Inspect registered passkeys, backup posture, and recent sign-in activity.' },
  },
  users: {
    zh: { label: '用户管理', description: '管理用户、角色、积分与账号状态。' },
    en: { label: 'User management', description: 'Manage users, roles, points, and account state.' },
  },
  activities: {
    zh: { label: '活动审核', description: '审核碳减排活动提交并处理待审记录。' },
    en: { label: 'Activity review', description: 'Review carbon reduction submissions and pending records.' },
  },
  products: {
    zh: { label: '兑换商品', description: '管理兑换商品、库存与价格。' },
    en: { label: 'Reward store', description: 'Manage redemption products, inventory, and pricing.' },
  },
  badges: {
    zh: { label: '徽章管理', description: '创建、编辑并发放成就徽章。' },
    en: { label: 'Badge management', description: 'Create, edit, and award achievement badges.' },
  },
  avatars: {
    zh: { label: '头像管理', description: '管理头像资源与默认展示。' },
    en: { label: 'Avatar library', description: 'Manage avatar assets and default selections.' },
  },
  exchanges: {
    zh: { label: '积分兑换', description: '审核兑换请求并更新履约状态。' },
    en: { label: 'Exchange orders', description: 'Review redemption requests and update fulfilment status.' },
  },
  broadcast: {
    zh: { label: '公告广播', description: '编写并发送系统公告，支持 HTML 预览与内置 AI 草稿。' },
    en: { label: 'Broadcast center', description: 'Compose and send announcements with HTML previews and built-in AI drafts.' },
  },
  systemLogs: {
    zh: { label: '系统日志', description: '查看审计日志与请求追踪。' },
    en: { label: 'System logs', description: 'Inspect audit logs and request traces.' },
  },
  aiWorkspace: {
    zh: { label: 'AI 工作台', description: '回到 AI 指挥台，继续治理会话与确认动作。' },
    en: { label: 'AI workspace', description: 'Work inside the dedicated admin AI workspace.' },
  },
  supportOps: {
    zh: { label: '客服运营', description: '管理智能分单、客服等级与容量、评分规则、SLA 升级与转单通知。' },
    en: { label: 'Support operations', description: 'Manage smart routing, agent levels and capacity, scoring rules, SLA escalation, and assignment notifications.' },
  },
  supportPortal: {
    zh: { label: '客服工作台', description: '处理工单队列、查看路由摘要，并完成目标客服转单同意。' },
    en: { label: 'Support desk', description: 'Work the live ticket queue, inspect routing summaries, and accept transfer requests as the target assignee.' },
  },
  llmUsage: {
    zh: { label: 'LLM 使用额度', description: '查看模型调用、令牌消耗、会话与提示词审计。' },
    en: { label: 'LLM usage', description: 'Monitor quota usage, token consumption, sessions, and prompt audits.' },
  },
  diagnostics: {
    zh: { label: 'API 诊断', description: '查看 OpenAPI 目录、接口定义与请求响应结构。' },
    en: { label: 'API diagnostics', description: 'Inspect the OpenAPI catalog and request/response definitions.' },
  },
};

const QUICK_ACTION_COPY = {
  'open-ai-workspace': {
    zh: { label: '打开 AI 工作台', description: '直接回到 AI 指挥台并聚焦输入框。' },
    en: { label: 'Open AI workspace', description: 'Jump straight into the admin AI workspace.' },
  },
  'search-users': {
    zh: { label: '搜索用户', description: '打开用户管理并聚焦搜索框。' },
    en: { label: 'Search users', description: 'Focus the user search box for quick lookup.' },
  },
  'checkin-status': {
    zh: { label: '查看打卡状态', description: '进入用户管理，检查打卡连击和补签额度。' },
    en: { label: 'Check check-in status', description: 'Inspect check-in streaks and makeup quota in user management.' },
  },
  'create-badge': {
    zh: { label: '创建新徽章', description: '跳转到徽章管理并打开新建入口。' },
    en: { label: 'Create new badge', description: 'Open badge management and launch creation mode.' },
  },
  'review-activities': {
    zh: { label: '查看待审核活动', description: '直接进入活动审核页并筛到待审核记录。' },
    en: { label: 'Review pending activities', description: 'Open activity review filtered to pending records.' },
  },
  broadcast: {
    zh: { label: '发送公告', description: '进入公告广播并打开新建草稿。' },
    en: { label: 'Send broadcast', description: 'Open the broadcast composer with drafting tools.' },
  },
};

const ACTION_DESCRIPTION_COPY = {
  get_admin_stats: {
    zh: '读取后台总览指标与平台整体运行状态。',
    en: 'Read dashboard-level metrics and operating state.',
  },
  get_pending_carbon_records: {
    zh: '读取待审核碳记录，便于复核与排序。',
    en: 'Read pending carbon records for review and prioritization.',
  },
  get_llm_usage_analytics: {
    zh: '读取模型调用、令牌消耗与会话趋势。',
    en: 'Read LLM usage, token consumption, and session trends.',
  },
  get_activity_statistics: {
    zh: '读取活动统计、排名与减排表现。',
    en: 'Read activity statistics, rankings, and reduction performance.',
  },
  generate_admin_report: {
    zh: '生成简洁的后台管理简报，汇总关键指标、待处理事项与 AI 使用情况。',
    en: 'Build a concise admin brief with key metrics, backlog, and AI usage.',
  },
  approve_carbon_records: {
    zh: '按记录 ID 准备批量通过待审核碳记录。',
    en: 'Prepare a bulk approval for pending carbon records by record id.',
  },
  reject_carbon_records: {
    zh: '按记录 ID 准备批量驳回待审核碳记录。',
    en: 'Prepare a bulk rejection for pending carbon records by record id.',
  },
  search_users: {
    zh: '查询用户并返回匹配结果与基础信息。',
    en: 'Search users and return matched accounts with basic details.',
  },
  get_user_overview: {
    zh: '读取单个用户的概览、状态与关键指标。',
    en: 'Read a user overview, status, and key account metrics.',
  },
  adjust_user_points: {
    zh: '准备调整用户积分，执行前需要管理员确认。',
    en: 'Prepare a points adjustment that requires admin confirmation before execution.',
  },
  create_user: {
    zh: '准备创建新用户账号，执行前需要确认。',
    en: 'Prepare a new user creation flow that requires confirmation.',
  },
  update_user_status: {
    zh: '准备变更用户状态，执行前需要确认。',
    en: 'Prepare a user status change that requires confirmation.',
  },
};

const ACTION_SCOPE_COPY = {
  admin_report: { zh: { label: '管理简报' }, en: { label: 'Admin report' } },
  pending_carbon_records: { zh: { label: '待审核碳记录' }, en: { label: 'Pending carbon records' } },
  llm_usage_analytics: { zh: { label: 'AI 用量' }, en: { label: 'LLM usage analytics' } },
  admin_stats: { zh: { label: '后台总览' }, en: { label: 'Admin stats' } },
};

const ROUTE_KEY_BY_PATH = {
  '/admin/dashboard': 'dashboard',
  '/admin/passkeys': 'passkeys',
  '/admin/users': 'users',
  '/admin/activities': 'activities',
  '/admin/products': 'products',
  '/admin/badges': 'badges',
  '/admin/avatars': 'avatars',
  '/admin/exchanges': 'exchanges',
  '/admin/broadcast': 'broadcast',
  '/admin/support': 'supportOps',
  '/support/': 'supportPortal',
  '/admin/system-logs': 'systemLogs',
  '/admin/ai': 'aiWorkspace',
  '/admin/llm-usage': 'llmUsage',
  '/admin/diagnostics': 'diagnostics',
};

const MotionDiv = motion.div;

function buildRouteWithQuery(route, query = {}) {
  if (!route) return null;

  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return route;

  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, String(value));
  }

  return `${route}?${params.toString()}`;
}

function hasRenderableMessages(conversation) {
  return Array.isArray(conversation?.messages) && conversation.messages.some((item) => item?.kind === 'message');
}

function normalizeI18nMessagePayload(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.key !== 'string' || payload.key.trim() === '') {
    return null;
  }

  return {
    key: payload.key,
    values: payload.values && typeof payload.values === 'object' && !Array.isArray(payload.values) ? payload.values : {},
  };
}

function getMessageI18nPayload(message) {
  return normalizeI18nMessagePayload(message?.message_i18n)
    || normalizeI18nMessagePayload(message?.meta?.data?.message_i18n)
    || normalizeI18nMessagePayload(message?.meta?.data?.metadata?.message_i18n)
    || normalizeI18nMessagePayload(message?.meta?.data?.meta?.message_i18n);
}

function translateI18nMessage(t, messageI18n, fallback) {
  if (!messageI18n || typeof t !== 'function') {
    return fallback;
  }

  return t(messageI18n.key, {
    ...messageI18n.values,
    defaultValue: fallback || messageI18n.key,
  });
}

function buildFallbackConversation(conversation, conversationId, previousConversation, userMessage, assistantMessage, assistantMessageI18n = null) {
  if (hasRenderableMessages(conversation)) {
    return conversation;
  }

  const previousMessages = Array.isArray(previousConversation?.messages)
    ? previousConversation.messages.filter((item) => item?.kind === 'message')
    : [];
  const nextMessages = [...previousMessages];

  if (userMessage) {
    nextMessages.push({
      id: `local-user-${conversationId || 'new'}-${nextMessages.length}`,
      kind: 'message',
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      meta: { data: { source: 'client_fallback' } },
    });
  }

  if (assistantMessage) {
    nextMessages.push({
      id: `local-assistant-${conversationId || 'new'}-${nextMessages.length}`,
      kind: 'message',
      role: 'assistant',
      content: assistantMessage,
      created_at: new Date().toISOString(),
      meta: {
        data: {
          source: 'client_fallback',
          ...(assistantMessageI18n ? { message_i18n: assistantMessageI18n } : {}),
        },
      },
    });
  }

  if (nextMessages.length === 0) {
    return conversation;
  }

  return {
    ...(previousConversation || {}),
    ...(conversation || {}),
    conversation_id: conversation?.conversation_id || conversationId || previousConversation?.conversation_id || null,
    messages: nextMessages,
    summary: {
      ...(previousConversation?.summary || {}),
      ...(conversation?.summary || {}),
      message_count: nextMessages.length,
      last_activity_at: new Date().toISOString(),
    },
  };
}

function getConversationMessageStepId(message) {
  const data = message?.meta?.data || {};
  return data?.meta?.step_id || data?.step_id || null;
}

function getConversationMessageActionName(message) {
  const data = message?.meta?.data || {};
  return data?.action_name
    || data?.request_payload?.action_name
    || data?.request_payload?.payload?.action
    || data?.payload?.action
    || data?.tool_name
    || message?.action
    || null;
}

function normalizeTimestampValue(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d+)?/.test(trimmed)) {
    return trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/, '$1T$2');
  }
  return trimmed;
}

function parseTimelineTime(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const normalized = normalizeTimestampValue(value);
  if (!normalized) {
    return Number.POSITIVE_INFINITY;
  }
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function getTimelineSortOrder(item) {
  const order = Number(item?.timeline_order);
  return Number.isFinite(order) ? order : 0;
}

function getTimelineSortRank(item) {
  if (item?.role === 'user') return 0;
  if (item?.kind === 'agent_step') return 1;
  if (item?.kind === 'tool') return 1;
  if (item?.role === 'assistant') return 2;
  return 3;
}

function getStepActionKeys(step) {
  return [
    step?.input?.action,
    step?.output?.meta?.action_name,
    step?.tool_name,
  ].filter(Boolean);
}

function buildConversationTimeline(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const runs = Array.isArray(conversation?.runs) ? conversation.runs : [];
  const stepsById = new Map();
  const stepMatchesByAction = new Map();
  const stepMatchCursorsByAction = new Map();
  const usedStepIds = new Set();
  let timelineOrder = 0;

  runs.forEach((run) => {
    const steps = Array.isArray(run?.steps) ? run.steps : [];
    steps.forEach((step) => {
      if (step?.step_id) {
        const match = { step, run };
        stepsById.set(step.step_id, match);
        getStepActionKeys(step).forEach((actionKey) => {
          const matches = stepMatchesByAction.get(actionKey) || [];
          matches.push(match);
          stepMatchesByAction.set(actionKey, matches);
        });
      }
    });
  });

  const timeline = messages.map((message) => {
    const nextOrder = timelineOrder;
    timelineOrder += 1;

    if (message?.kind !== 'tool') {
      return { ...message, timeline_order: nextOrder };
    }

    const stepId = getConversationMessageStepId(message);
    const actionName = getConversationMessageActionName(message);
    const actionMatches = actionName ? stepMatchesByAction.get(actionName) || [] : [];
    let match = stepId ? stepsById.get(stepId) : null;
    if (!match && actionName && actionMatches.length > 0) {
      const cursor = stepMatchCursorsByAction.get(actionName) || 0;
      for (let index = cursor; index < actionMatches.length; index += 1) {
        const candidate = actionMatches[index];
        stepMatchCursorsByAction.set(actionName, index + 1);
        if (candidate?.step?.step_id && !usedStepIds.has(candidate.step.step_id)) {
          match = candidate;
          break;
        }
      }
    }
    if (message?.kind === 'tool' && match) {
      usedStepIds.add(match.step.step_id);
      return {
        id: `agent-step-${match.step.step_id}`,
        kind: 'agent_step',
        created_at: message.created_at || match.step.started_at,
        timeline_order: nextOrder,
        message,
        step: match.step,
        run: match.run,
      };
    }
    return { ...message, timeline_order: nextOrder };
  });

  runs.forEach((run) => {
    const steps = Array.isArray(run?.steps) ? run.steps : [];
    steps.forEach((step) => {
      if (!step?.step_id || usedStepIds.has(step.step_id)) {
        return;
      }
      usedStepIds.add(step.step_id);
      timeline.push({
        id: `agent-step-${step.step_id}`,
        kind: 'agent_step',
        created_at: step.started_at || run.started_at,
        timeline_order: timelineOrder,
        step,
        run,
      });
      timelineOrder += 1;
    });
  });

  return timeline.sort((left, right) => {
    const leftTime = parseTimelineTime(left?.created_at || left?.step?.started_at || left?.run?.started_at || '');
    const rightTime = parseTimelineTime(right?.created_at || right?.step?.started_at || right?.run?.started_at || '');
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    const orderDiff = getTimelineSortOrder(left) - getTimelineSortOrder(right);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    const leftRank = getTimelineSortRank(left);
    const rightRank = getTimelineSortRank(right);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return 0;
  });
}

function createOptimisticUserMessage(content, conversationId, baselineUserMessageMatches = 0, fallbackSequence = 0) {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fallbackSequence}`;

  return {
    id: `local-user-${conversationId || 'new'}-${randomId}`,
    kind: 'message',
    role: 'user',
    content,
    created_at: new Date().toISOString(),
    meta: {
      data: {
        source: 'client_stream_optimistic',
        baseline_user_message_matches: baselineUserMessageMatches,
      },
    },
  };
}

function getStreamToolKey(event, data, items = []) {
  const runId = data?.run_id || 'run';
  if (data?.step_id != null) {
    return `tool:${runId}:${data.step_id}`;
  }

  if (data?.proposal?.proposal_id) {
    const proposalId = data.proposal.proposal_id;
    const matched = items.find((item) => item?.kind === 'stream_tool' && item?.data?.proposal?.proposal_id === proposalId);
    if (matched?.toolKey) {
      return matched.toolKey;
    }
  }

  if (data?.tool_name) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'stream_tool'
        && item?.data?.run_id === data.run_id
        && item?.data?.tool_name === data.tool_name
        && ['running', 'waiting_input', 'waiting_approval'].includes(item?.data?.status)) {
        return item.toolKey;
      }
    }

    return `tool:${runId}:${data.tool_name}:${data?.sequence ?? data?._client_sequence ?? items.length}`;
  }

  return null;
}

function getStreamToolStatus(event, data, previousStatus) {
  if (event === 'tool.started') return 'running';
  if (event === 'tool.error') return 'error';
  if (event === 'missing.input') return 'waiting_input';
  if (event === 'approval.required') return 'waiting_approval';
  return data?.status || previousStatus || 'success';
}

function summarizeObject(value, isZh, t) {
  const emptyText = t('admin.aiWorkspace.stream.emptyStructuredData', {
    defaultValue: isZh ? '没有附带结构化数据。' : 'No structured data attached.',
  });

  if (!value || typeof value !== 'object') {
    return emptyText;
  }

  const entries = Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && item !== '')
    .slice(0, 4)
    .map(([key, item]) => {
      if (Array.isArray(item)) {
        return `${key}: ${item.slice(0, 3).join(', ')}${item.length > 3 ? '…' : ''}`;
      }
      if (typeof item === 'object') {
        return `${key}: ${Object.keys(item).slice(0, 3).join(', ') || '{}'}`;
      }
      return `${key}: ${String(item)}`;
    });

  if (entries.length === 0) {
    return emptyText;
  }

  return entries.join(' | ');
}

function formatMissingFieldLabel(field, isZh, t) {
  if (field == null || field === '') {
    return t('admin.aiWorkspace.stream.unknownField', { defaultValue: isZh ? '未知字段' : 'Unknown field' });
  }
  if (typeof field !== 'object') {
    return String(field);
  }

  const label = field.field ?? field.label ?? field.name ?? field.key ?? field.path;
  if (label != null && label !== '') {
    return String(label);
  }

  try {
    return JSON.stringify(field);
  } catch {
    return summarizeObject(field, isZh, t);
  }
}

function mergeStreamToolData(previousData, event, data) {
  return {
    ...(previousData || {}),
    ...(data || {}),
    status: getStreamToolStatus(event, data, previousData?.status),
    arguments: data?.arguments ?? previousData?.arguments,
    result: data?.result ?? previousData?.result,
    proposal: data?.proposal ?? previousData?.proposal,
    suggestion: data?.suggestion ?? previousData?.suggestion,
    missing: data?.missing ?? previousData?.missing,
    error: data?.error ?? previousData?.error,
    last_event: event,
  };
}

function reduceStreamState(state, event, data) {
  const currentState = state || createEmptyStreamState();
  const items = Array.isArray(currentState.items) ? currentState.items : [];

  if (event === 'run.started') {
    const runId = data?.run_id || 'run';
    const statusItem = {
      kind: 'stream_status',
      event,
      data: { ...(data || {}), status: 'running' },
      id: `${runId}-${data?.sequence ?? 1}`,
    };
    const existingIndex = items.findIndex((item) => item.kind === 'stream_status' && item.data?.run_id === runId);

    return {
      ...currentState,
      items: existingIndex >= 0
        ? items.map((item, index) => (index === existingIndex ? statusItem : item))
        : trimStreamItems([...items, statusItem]),
    };
  }

  if (event === 'run.finished') {
    const runId = data?.run_id;
    return {
      ...currentState,
      items: items.map((item) => {
        if (item.kind === 'stream_status' && item.data?.run_id === runId) {
          return { ...item, event, data: { ...item.data, ...(data || {}), status: 'finished' } };
        }
        if (item.kind === 'assistant_stream' && (!runId || item.data?.run_id === runId)) {
          return { ...item, event, data: { ...item.data, ...(data || {}), streaming: false } };
        }
        return item;
      }),
    };
  }

  if (event === 'assistant.delta' || event === 'assistant.message') {
    const runId = data?.run_id || 'run';
    const assistantKey = data?.message_id || data?.response_id || data?.step_id || runId;
    const index = items.findIndex((item) => (
      item.kind === 'assistant_stream'
      && item.data?.run_id === runId
      && (item.data?.assistant_key || item.data?.message_id || item.data?.response_id || item.data?.step_id || item.data?.run_id) === assistantKey
    ));
    const content = event === 'assistant.delta'
      ? `${index >= 0 ? items[index].data?.content || '' : ''}${data?.content || ''}`
      : (data?.content || (index >= 0 ? items[index].data?.content : '') || '');
    const nextItem = {
      kind: 'assistant_stream',
      event,
      data: {
        ...(index >= 0 ? items[index].data : {}),
        ...(data || {}),
        assistant_key: assistantKey,
        content,
        streaming: event === 'assistant.delta',
      },
      id: `assistant-${runId}-${assistantKey}`,
    };

    if (index >= 0) {
      return {
        ...currentState,
        items: items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
      };
    }

    return {
      ...currentState,
      items: trimStreamItems([...items, nextItem]),
    };
  }

  if (event?.startsWith('tool.') || event === 'missing.input' || event === 'approval.required') {
    const toolKey = getStreamToolKey(event, data, items);
    if (toolKey) {
      const index = items.findIndex((item) => item.kind === 'stream_tool' && item.toolKey === toolKey);
      const nextItem = {
        kind: 'stream_tool',
        event,
        data: mergeStreamToolData(index >= 0 ? items[index].data : null, event, data),
        id: toolKey,
        toolKey,
      };
      if (index >= 0) {
        return {
          ...currentState,
          items: items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
        };
      }

      return {
        ...currentState,
        items: trimStreamItems([...items, nextItem]),
      };
    }
  }

  return {
    ...currentState,
    items: trimStreamItems([
      ...items,
      {
        kind: 'stream_event',
        event,
        data,
        id: `${event}-${data?.run_id || 'run'}-${data?.step_id ?? data?.sequence ?? data?._client_sequence ?? items.length}`,
      },
    ]),
  };
}

function formatAbsoluteTime(value, locale = 'zh-CN') {
  if (!value) return '--';

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(normalizeTimestampValue(value)));
  } catch {
    return String(value);
  }
}

function formatRelativeTime(value, locale = 'zh-CN', isZh = true) {
  if (!value) return isZh ? '刚刚' : 'just now';

  const time = new Date(normalizeTimestampValue(value)).getTime();
  if (Number.isNaN(time)) {
    return formatAbsoluteTime(value, locale);
  }

  const diffSeconds = Math.round((time - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absSeconds < 60) return rtf.format(diffSeconds, 'second');
  if (absSeconds < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absSeconds < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  if (absSeconds < 2592000) return rtf.format(Math.round(diffSeconds / 86400), 'day');
  return rtf.format(Math.round(diffSeconds / 2592000), 'month');
}

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '--';
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}k`;
  return String(Math.round(numeric));
}

function formatLatency(value, isZh) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return isZh ? '未记录' : 'Not recorded';
  }

  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(2)}s`;
  }

  return `${Math.round(numeric)}ms`;
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prettifyActionName(value) {
  if (!value || typeof value !== 'string') return null;
  return value
    .replace(/^admin_ai_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickLocalizedCopy(entry, isZh, field) {
  if (!entry) return null;
  return isZh ? entry?.zh?.[field] : entry?.en?.[field];
}

function getLocalizedActionLabel(action, isZh) {
  const name = action?.name || action?.action_name;
  const label = action?.label;
  if (!isZh) return label || prettifyActionName(name) || 'Admin action';

  const map = {
    get_admin_stats: '查看后台总览',
    get_pending_carbon_records: '查看待审核碳记录',
    get_llm_usage_analytics: '查看 AI 用量',
    get_activity_statistics: '查看活动统计',
    generate_admin_report: '生成管理简报',
    approve_carbon_records: '准备批量通过碳记录',
    reject_carbon_records: '准备批量驳回碳记录',
    search_users: '搜索用户',
    get_user_overview: '查看用户概览',
    adjust_user_points: '准备调整用户积分',
    create_user: '准备创建用户',
    update_user_status: '准备变更用户状态',
    award_badge_to_user: '准备发放徽章',
    revoke_badge_from_user: '准备撤销徽章',
    update_exchange_status: '准备更新兑换单状态',
    update_product_status: '准备更新商品状态',
    adjust_product_inventory: '准备调整商品库存',
  };

  return map[name] || label || prettifyActionName(name) || '后台动作';
}

function getLocalizedActionDescription(action, isZh) {
  const name = action?.name || action?.action_name;
  const localized = isZh ? ACTION_DESCRIPTION_COPY[name]?.zh : ACTION_DESCRIPTION_COPY[name]?.en;
  return localized || action?.description || (isZh ? '暂无说明。' : 'No description.');
}

function getLocalizedQuickActionCopy(action, isZh) {
  const localized = QUICK_ACTION_COPY[action?.id] || ROUTE_COPY[action?.routeId];
  return {
    label: pickLocalizedCopy(localized, isZh, 'label') || action?.label || (isZh ? '快捷入口' : 'Shortcut'),
    description: pickLocalizedCopy(localized, isZh, 'description') || action?.description || (isZh ? '直接跳转到对应后台页面。' : 'Jump to the related admin page.'),
  };
}

function getLocalizedNavigationCopy(target, isZh) {
  const localized = ROUTE_COPY[target?.id];
  return {
    label: pickLocalizedCopy(localized, isZh, 'label') || target?.label || (isZh ? '后台页面' : 'Admin page'),
    description: pickLocalizedCopy(localized, isZh, 'description') || target?.description || (isZh ? '打开对应后台模块。' : 'Open the related admin module.'),
  };
}

function getLocalizedRouteLabel(route, isZh, fallbackLabel = null) {
  const routeKey = ROUTE_KEY_BY_PATH[route];
  const localized = routeKey ? ROUTE_COPY[routeKey] : null;
  return pickLocalizedCopy(localized, isZh, 'label') || fallbackLabel || (isZh ? '打开建议页面' : 'Open suggestion');
}

function getLocalizedScopeLabel(scope, isZh) {
  return pickLocalizedCopy(ACTION_SCOPE_COPY[scope], isZh, 'label') || scope || (isZh ? '结果' : 'Result');
}

function getLocalizedConfirmationPolicy(policy, isZh) {
  if (policy === 'write_requires_confirmation') {
    return isZh ? '写入前需确认' : 'Write requires confirmation';
  }
  return policy || (isZh ? '依据系统策略' : 'Policy driven');
}

function getLocalizedCallStatus(status, isZh) {
  switch (status) {
    case 'success':
      return isZh ? '成功' : 'Success';
    case 'failed':
      return isZh ? '失败' : 'Failed';
    case 'running':
      return isZh ? '执行中' : 'Running';
    default:
      return isZh ? '未知' : 'Unknown';
  }
}

function getLocalizedEventKind(kind, isZh) {
  switch (kind) {
    case 'tool':
      return isZh ? '工具' : 'Tool';
    case 'action_proposed':
      return isZh ? '提案' : 'Proposal';
    case 'action_event':
      return isZh ? '事件' : 'Event';
    case 'message':
      return isZh ? '消息' : 'Message';
    default:
      return isZh ? '事件' : 'Event';
  }
}

function buildEventCopy(item, isZh, t) {
  const metaData = item?.meta?.data || {};
  const actionName = metaData.action_name || metaData.tool_name || item?.proposal?.action_name || item?.action || null;
  const actionLabel = getLocalizedActionLabel({
    name: actionName,
    label: metaData.label || item?.proposal?.label,
  }, isZh);
  const status = item?.status || '';

  if (item?.kind === 'tool') {
    return {
      title: isZh ? `调用工具：${actionLabel}` : `Tool call: ${actionLabel}`,
      description: metaData.summary || summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh, t),
      tone: 'tool',
    };
  }

  if (item?.kind === 'action_proposed') {
    return {
      title: isZh ? `待确认：${actionLabel}` : `Pending: ${actionLabel}`,
      description: item?.proposal?.summary || metaData.summary || summarizeObject(item?.proposal?.payload || metaData.payload || metaData, isZh, t),
      tone: 'proposal',
    };
  }

  if (item?.kind === 'action_event') {
    if (status === 'failed') {
      return {
        title: isZh ? `执行失败：${actionLabel}` : `Failed: ${actionLabel}`,
        description: summarizeObject(metaData.new_data || metaData.result || metaData.request_payload || metaData.payload || metaData, isZh, t),
        tone: 'failed',
      };
    }

    if ((item?.action || '').endsWith('_rejected')) {
      return {
        title: isZh ? `已驳回：${actionLabel}` : `Rejected: ${actionLabel}`,
        description: summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh, t),
        tone: 'muted',
      };
    }

    if ((item?.action || '').endsWith('_confirmed')) {
      return {
        title: isZh ? `已确认：${actionLabel}` : `Confirmed: ${actionLabel}`,
        description: summarizeObject(metaData.request_payload || metaData.payload || metaData, isZh, t),
        tone: 'success',
      };
    }

    if ((item?.action || '').endsWith('_executed')) {
      return {
        title: isZh ? `已执行：${actionLabel}` : `Executed: ${actionLabel}`,
        description: summarizeObject(metaData.new_data || metaData.result || metaData, isZh, t),
        tone: 'success',
      };
    }
  }

  return {
    title: actionLabel,
    description: item?.content || summarizeObject(metaData, isZh, t),
    tone: 'muted',
  };
}

function getConversationStatusLabel(status, isZh) {
  switch (status) {
    case 'waiting_confirmation':
      return isZh ? '待确认' : 'Awaiting confirmation';
    case 'completed':
      return isZh ? '已完成' : 'Completed';
    case 'active':
      return isZh ? '进行中' : 'Active';
    default:
      return isZh ? '会话' : 'Session';
  }
}

const PANEL_SHELL_CLASS = 'overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]';
const PANEL_DIVIDER_CLASS = 'border-slate-200/70 dark:border-white/8';
const SURFACE_MUTED_CLASS = 'rounded-[22px] border border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-black/20';
const SURFACE_SOFT_CLASS = 'rounded-[22px] border border-slate-200/80 bg-white/78 dark:border-white/8 dark:bg-white/[0.02]';
const TEXT_PRIMARY_CLASS = 'text-slate-950 dark:text-white';
const TEXT_SECONDARY_CLASS = 'text-slate-600 dark:text-slate-400';
const TEXT_TERTIARY_CLASS = 'text-slate-500 dark:text-slate-500';
const OUTLINE_BUTTON_CLASS = 'rounded-full border border-slate-300/80 bg-white/70 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/8';
const INPUT_SHELL_CLASS = 'border border-slate-200/80 bg-white/75 text-slate-900 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500';
const PAGE_SCROLLBAR_CLASS = '[&_[data-slot=scroll-area-scrollbar]]:p-0.5 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-3 [&_[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:h-3 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:bg-slate-300/75 dark:[&_[data-slot=scroll-area-thumb]]:bg-white/16 hover:[&_[data-slot=scroll-area-thumb]]:bg-slate-400/90 dark:hover:[&_[data-slot=scroll-area-thumb]]:bg-white/24';
const INLINE_SCROLLBAR_CLASS = '[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.75)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.16)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 dark:[&::-webkit-scrollbar-thumb]:bg-white/16 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/90 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/24';

function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  headerClassName,
  titleClassName,
  stackAction = false,
  children,
}) {
  return (
    <div className={cn(
      PANEL_SHELL_CLASS,
      className
    )}>
      {(title || description || action) ? (
        <div className={cn(
          `px-5 py-4 ${PANEL_DIVIDER_CLASS}`,
          stackAction ? 'space-y-3' : 'flex flex-col gap-3',
          headerClassName
        )}>
          <div className="min-w-0 flex-1">
            {title ? <div className={cn(`break-words text-sm font-semibold ${TEXT_PRIMARY_CLASS}`, titleClassName)}>{title}</div> : null}
            {description ? <div className={cn(`mt-1 break-words text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{description}</div> : null}
          </div>
          {action ? (
            <div className={cn('min-w-0', stackAction ? 'w-full' : 'flex flex-wrap items-center gap-2')}>
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </div>
  );
}

function StatusChip({ tone = 'neutral', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
        tone === 'neutral' && 'border-slate-200 bg-white/85 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-slate-200'
      )}
    >
      {children}
    </span>
  );
}

function MetricTile({ label, value, hint }) {
  return (
    <div className={cn(SURFACE_MUTED_CLASS, 'px-4 py-4')}>
      <div className={cn(`text-[11px] uppercase tracking-[0.22em] ${TEXT_TERTIARY_CLASS}`)}>{label}</div>
      <div className={cn(`mt-3 text-2xl font-semibold ${TEXT_PRIMARY_CLASS}`)}>{value}</div>
      {hint ? <div className={cn(`mt-2 break-words text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{hint}</div> : null}
    </div>
  );
}

function ConversationRow({ item, active, locale, isZh, onSelect }) {
  const status = item?.status;
  const pendingCount = Number(item?.pending_action_count || 0);
  const messageCount = Number(item?.message_count || 0);
  const llmCalls = Number(item?.llm_calls || 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.conversation_id)}
      className={cn(
        'w-full rounded-[22px] border px-4 py-4 text-left transition-all',
        active
          ? 'border-emerald-300 bg-emerald-50/90 shadow-[0_18px_45px_rgba(16,185,129,0.12)] dark:border-emerald-400/35 dark:bg-emerald-400/[0.12] dark:shadow-[0_18px_45px_rgba(16,185,129,0.14)]'
          : 'border-slate-200/80 bg-white/78 hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`line-clamp-2 break-words pr-2 text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>
            {item.title || (isZh ? '未命名会话' : 'Untitled session')}
          </div>
          <div className={cn(`mt-1 line-clamp-2 break-all text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>
            {item.last_message_preview || (isZh ? '尚无摘要。' : 'No summary yet.')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
            {pendingCount > 0
              ? `${pendingCount} ${isZh ? '待确认' : 'pending'}`
              : `${messageCount} ${isZh ? '条' : 'msgs'}`}
          </span>
          <span className={cn(`text-[10px] uppercase tracking-[0.2em] ${TEXT_TERTIARY_CLASS}`)}>
            {getConversationStatusLabel(status, isZh)}
          </span>
        </div>
      </div>
      <div className={cn(`mt-3 flex items-center justify-between gap-3 text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3 w-3" />
          {formatRelativeTime(item.last_activity_at, locale, isZh)}
        </span>
        <span>{formatAbsoluteTime(item.last_activity_at, locale)}</span>
      </div>
      <div className={cn(`mt-3 flex flex-wrap items-center gap-2 text-[10px] ${TEXT_SECONDARY_CLASS}`)}>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
          {llmCalls} LLM
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
          {formatCompactNumber(item?.total_tokens || 0)} tok
        </span>
        {item?.last_model ? (
          <span className="truncate rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-white/8 dark:bg-black/20">
            {item.last_model}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function QuickLaunchButton({ label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`break-words text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>{label}</div>
          {description ? <div className={cn(`mt-1 break-words text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{description}</div> : null}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200" />
      </div>
    </button>
  );
}

function PromptButton({ label, prompt, onUse }) {
  return (
    <button
      type="button"
      onClick={() => onUse(prompt)}
      className="group rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/8 dark:bg-black/20 dark:hover:border-emerald-400/25 dark:hover:bg-emerald-400/[0.08]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>{label}</div>
          <div className={cn(`mt-2 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{prompt}</div>
        </div>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-200" />
      </div>
    </button>
  );
}

function RiskBadge({ action, isZh }) {
  if (action?.requires_confirmation) {
    return <Badge className="border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100">{isZh ? '需确认' : 'Confirm required'}</Badge>;
  }

  if (action?.risk_level === 'write') {
    return <Badge className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/15 dark:text-rose-100">{isZh ? '写入' : 'Write'}</Badge>;
  }

  if (action?.risk_level === 'read') {
    return <Badge className="border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/15 dark:text-sky-100">{isZh ? '读取' : 'Read'}</Badge>;
  }

  return <Badge className="border border-slate-200 bg-white/85 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">{isZh ? '待定' : 'Pending'}</Badge>;
}

function PendingActionTile({ action, disabled, isZh, onConfirm, onReject }) {
  const actionLabel = getLocalizedActionLabel(action, isZh);
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>
            {actionLabel || action.action_name || `${isZh ? '提案' : 'Proposal'} #${action.proposal_id}`}
          </div>
          <div className={cn(`mt-2 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>
            {action.summary || (isZh ? '系统已生成一条待确认操作。' : 'A pending action is ready for review.')}
          </div>
        </div>
        <RiskBadge action={action} isZh={isZh} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled}
          className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
          onClick={() => onConfirm(action.proposal_id)}
        >
          {isZh ? '确认执行' : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className={OUTLINE_BUTTON_CLASS}
          onClick={() => onReject(action.proposal_id)}
        >
          {isZh ? '驳回' : 'Reject'}
        </Button>
      </div>
    </div>
  );
}

function CapabilityTile({ action, isZh }) {
  return (
    <div className={cn(SURFACE_SOFT_CLASS, 'px-4 py-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>{getLocalizedActionLabel(action, isZh)}</div>
          <div className={cn(`mt-1 break-words text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{getLocalizedActionDescription(action, isZh)}</div>
        </div>
        <RiskBadge action={action} isZh={isZh} />
      </div>
      {Array.isArray(action.requirements) && action.requirements.length > 0 ? (
        <div className={cn(`mt-3 text-[11px] leading-5 ${TEXT_TERTIARY_CLASS}`)}>
          {isZh ? '所需字段' : 'Required fields'}: {action.requirements.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition-all',
        active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.14] dark:text-emerald-100'
          : 'border-slate-200/80 bg-white/75 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.05]'
      )}
    >
      {children}
    </button>
  );
}

function WorkspaceSectionButton({ active, icon, label, count, onClick }) {
  const iconNode = icon ? React.createElement(icon, { className: 'h-4 w-4' }) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-50 dark:shadow-[0_10px_24px_rgba(16,185,129,0.12)]'
          : 'border-slate-200/80 bg-white/78 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/18 dark:hover:text-white'
      )}
    >
      {iconNode}
      <span>{label}</span>
      {count !== undefined ? (
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[11px]',
          active
            ? 'bg-white/15 text-white dark:bg-black/20 dark:text-emerald-50'
            : 'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-400'
        )}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function AgentStreamEventCard({ item, isZh, disabled, onRollback, t }) {
  const event = item?.event;
  const data = item?.data || {};
  const isToolItem = item?.kind === 'stream_tool' || event?.startsWith('tool.');
  const hasToolInput = data.arguments != null && data.arguments !== '';
  const hasToolResult = data.result != null && data.result !== '';

  if (item?.kind === 'stream_status') {
    const status = data.status || (event === 'run.finished' ? 'finished' : 'running');
    const label = status === 'finished'
      ? t('admin.aiWorkspace.stream.status.runFinished', { defaultValue: isZh ? 'Agent 已完成处理' : 'Agent run finished' })
      : status === 'error'
        ? t('admin.aiWorkspace.stream.status.runFailed', { defaultValue: isZh ? 'Agent 处理失败' : 'Agent run failed' })
        : t('admin.aiWorkspace.stream.status.runStarted', { defaultValue: isZh ? 'Agent 已开始处理' : 'Agent run started' });

    return (
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
        <div className="flex items-center gap-2 font-medium">
          {status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {label}
        </div>
        {data.run_id ? <div className="mt-1 font-mono text-[11px] opacity-70">{data.run_id}</div> : null}
      </div>
    );
  }

  if (item?.kind === 'assistant_stream' || event === 'assistant.delta' || event === 'assistant.message') {
    const content = event === 'assistant.message'
      ? translateI18nMessage(
          t,
          normalizeI18nMessagePayload(data.message_i18n)
            || normalizeI18nMessagePayload(data.metadata?.message_i18n)
            || normalizeI18nMessagePayload(data.meta?.message_i18n),
          data.content
        )
      : data.content;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          {data.streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
          {data.streaming
            ? t('admin.aiWorkspace.stream.status.streaming', { defaultValue: isZh ? '正在生成回复' : 'Streaming response' })
            : t('admin.aiWorkspace.stream.status.assistantMessage', { defaultValue: isZh ? 'AI 回复' : 'Assistant message' })}
        </div>
        <AdminAiMarkdown content={content} />
      </div>
    );
  }

  if (isToolItem) {
    const status = data.status || 'success';
    const tone = status === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100'
      : status === 'running'
        ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100'
        : status === 'waiting_approval' || status === 'waiting_input'
          ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
    const missing = Array.isArray(data.missing) ? data.missing : [];

    return (
      <div className={cn('rounded-2xl border px-4 py-3 text-sm', tone)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            {status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TerminalSquare className="h-4 w-4" />}
            {data.tool_name || (isZh ? '工具调用' : 'Tool call')}
          </div>
          <Badge variant="outline" className="border-current/30 text-current">{status}</Badge>
        </div>
        {data.error ? <div className="mt-2 text-xs opacity-80">{data.error}</div> : null}
        {data.proposal?.summary ? <div className="mt-2 text-xs opacity-80">{data.proposal.summary}</div> : null}
        {data.message ? <div className="mt-2 text-xs opacity-80">{data.message}</div> : null}
        {data.step_id ? <div className="mt-2 font-mono text-[11px] opacity-60">{data.step_id}</div> : null}
        {missing.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((field, index) => {
              const label = formatMissingFieldLabel(field, isZh, t);
              return (
                <Badge key={`${label}-${index}`} variant="outline" className="border-current/20 text-current">
                  {label}
                </Badge>
              );
            })}
          </div>
        ) : null}
        {hasToolInput || hasToolResult ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ResultSnapshot title={t('admin.aiWorkspace.stream.toolInput', { defaultValue: isZh ? '工具输入' : 'Tool input' })} value={data.arguments} isZh={isZh} />
            <ResultSnapshot title={t('admin.aiWorkspace.stream.toolResult', { defaultValue: isZh ? '工具结果' : 'Tool result' })} value={data.result} isZh={isZh} />
          </div>
        ) : null}
        {data.proposal ? <ResultSnapshot title={t('admin.aiWorkspace.stream.approvalProposal', { defaultValue: isZh ? '确认提案' : 'Approval proposal' })} value={data.proposal} isZh={isZh} /> : null}
      </div>
    );
  }

  if (event === 'approval.required') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" />
          {t('admin.aiWorkspace.stream.approvalRequired', { defaultValue: isZh ? '需要在对话中确认' : 'Approval required' })}
        </div>
        <div className="mt-2 leading-6">{data.proposal?.summary || data.proposal?.label || t('admin.aiWorkspace.stream.waitingApproval', { defaultValue: isZh ? '等待管理员确认后执行。' : 'Waiting for admin approval before execution.' })}</div>
      </div>
    );
  }

  if (event === 'missing.input') {
    const missing = Array.isArray(data.missing) ? data.missing : [];
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
        <div className="flex items-center gap-2 font-semibold">
          <Command className="h-4 w-4" />
          {isZh ? '需要补充信息' : 'Missing input'}
        </div>
        <div className="mt-2 leading-6">{data.message || (isZh ? '请补充必要字段后继续。' : 'Add the required fields to continue.')}</div>
        {missing.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((item, index) => (
              <Badge key={`${item?.field || 'field'}-${index}`} variant="outline" className="border-current/20 text-current">
                {item?.field || item}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (event === 'rollback.available') {
    const rollback = data.rollback || {};
    const rollbackPrompt = rollback.prompt_i18n?.[isZh ? 'zh' : 'en'] || rollback.prompt;
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-100">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4" />
          {isZh ? '可回滚操作已准备' : 'Rollback available'}
        </div>
        <div className="mt-2 leading-6">
          {rollbackPrompt || (isZh ? '可生成反向操作提案，执行前仍需管理员确认。' : 'A reverse-action proposal can be created and will still require approval.')}
        </div>
        {rollback.action_name ? (
          <div className="mt-2 inline-flex rounded-md border border-current/20 px-2 py-1 font-mono text-[11px]">
            {rollback.action_name}
          </div>
        ) : null}
        {rollback.action_name && rollback.payload ? (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className="rounded-full border-current/30 text-current hover:bg-current/10"
              onClick={() => onRollback?.(rollback)}
            >
              {isZh ? '生成回滚确认卡' : 'Create rollback card'}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (event === 'run.error') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
        <div className="font-semibold">{data.code || (isZh ? '运行失败' : 'Run failed')}</div>
        <div className="mt-1">{data.error}</div>
      </div>
    );
  }

  return null;
}

function JsonPreview({ value, className }) {
  const text = stringifyValue(value);
  if (!text) return null;

  return (
    <pre className={cn(`max-h-[20rem] overflow-auto whitespace-pre-wrap break-all rounded-[18px] border border-white/8 bg-[#050816] px-3 py-3 text-[11px] leading-5 text-slate-300 ${INLINE_SCROLLBAR_CLASS}`, className)}>
      {text}
    </pre>
  );
}

function isPlainObject(value) {
  return value && Object.prototype.toString.call(value) === '[object Object]';
}

const SENSITIVE_FIELD_PATTERN = /(?:password|passcode|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|authorization|credential|cvv|credit[_-]?card)/i;
const SENSITIVE_STRING_PATTERNS = [
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***'],
  [/((?:password|passcode|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|authorization|credential|cvv|credit[_-]?card)\s*[:=]\s*)("[^"]+"|'[^']+'|[^\s,;]+)/gi, '$1***'],
];

function maskSensitiveString(value) {
  return SENSITIVE_STRING_PATTERNS.reduce(
    (masked, [pattern, replacement]) => masked.replace(pattern, replacement),
    value
  );
}

function maskSensitiveValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveValue(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key) ? '***' : maskSensitiveValue(item),
      ])
    );
  }
  if (typeof value === 'string') {
    return maskSensitiveString(value);
  }
  return value;
}

function formatSnapshotLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSimpleSnapshotValue(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatSnapshotValue(value, isZh) {
  if (value == null || value === '') {
    return isZh ? '无' : 'None';
  }
  if (typeof value === 'boolean') {
    return value ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No');
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '--';
  }
  return maskSensitiveString(String(value));
}

function getTableColumns(rows) {
  const priority = ['id', 'status', 'username', 'email', 'name', 'activity_name', 'date', 'carbon_saved', 'points_earned', 'total'];
  const keys = [];
  rows.forEach((row) => {
    if (!isPlainObject(row)) return;
    Object.entries(row).forEach(([key, value]) => {
      if (isSimpleSnapshotValue(value) && !keys.includes(key)) {
        keys.push(key);
      }
    });
  });

  return keys
    .sort((left, right) => {
      const leftPriority = priority.indexOf(left);
      const rightPriority = priority.indexOf(right);
      if (leftPriority !== -1 || rightPriority !== -1) {
        return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
      }
      return left.localeCompare(right);
    })
    .slice(0, 6);
}

function RawJsonToggle({ value, isZh }) {
  const [open, setOpen] = useState(false);

  if (!Array.isArray(value) && !isPlainObject(value)) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-white/8">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(`inline-flex items-center gap-1 text-[11px] font-medium ${TEXT_TERTIARY_CLASS} hover:text-slate-700 dark:hover:text-slate-300`)}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        {open ? (isZh ? '隐藏原始 JSON' : 'Hide raw JSON') : (isZh ? '查看原始 JSON' : 'View raw JSON')}
      </button>
      {open ? <JsonPreview value={value} className="mt-2" /> : null}
    </div>
  );
}

function SnapshotArrayTable({ value, isZh }) {
  if (!value.length) {
    return <div className={cn(`text-xs ${TEXT_TERTIARY_CLASS}`)}>{isZh ? '空列表' : 'Empty list'}</div>;
  }

  const objectRows = value.filter((item) => isPlainObject(item));
  const columns = getTableColumns(objectRows);

  if (objectRows.length === 0 || columns.length === 0) {
    return (
      <div className="space-y-1.5">
        {value.slice(0, 6).map((item, index) => (
          <div key={index} className={cn(`rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs ${TEXT_SECONDARY_CLASS} dark:border-white/8 dark:bg-white/[0.03]`)}>
            {formatSnapshotValue(item, isZh)}
          </div>
        ))}
        {value.length > 6 ? <div className={cn(`text-[11px] ${TEXT_TERTIARY_CLASS}`)}>{isZh ? `另有 ${value.length - 6} 项` : `${value.length - 6} more items`}</div> : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 dark:border-white/8 dark:bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            <tr>
              {columns.map((column) => <th key={column} className="px-3 py-2 font-medium">{formatSnapshotLabel(column)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-white/8">
            {objectRows.slice(0, 5).map((row, index) => (
              <tr key={row.id || row.uuid || index}>
                {columns.map((column) => (
                  <td key={column} className={cn(`max-w-[14rem] truncate px-3 py-2 ${TEXT_SECONDARY_CLASS}`)}>
                    {formatSnapshotValue(row[column], isZh)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.length > 5 ? (
        <div className={cn(`border-t border-slate-200/80 px-3 py-2 text-[11px] ${TEXT_TERTIARY_CLASS} dark:border-white/8`)}>
          {isZh ? `仅显示前 5 项，共 ${value.length} 项` : `Showing 5 of ${value.length} items`}
        </div>
      ) : null}
    </div>
  );
}

function ReadableSnapshot({ value, isZh, depth = 0 }) {
  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        <SnapshotArrayTable value={value} isZh={isZh} />
        <RawJsonToggle value={value} isZh={isZh} />
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([, item]) => item != null && item !== '');
    const simpleEntries = entries.filter(([, item]) => isSimpleSnapshotValue(item));
    const nestedEntries = entries.filter(([, item]) => Array.isArray(item) || isPlainObject(item));

    return (
      <div className="space-y-3">
        {simpleEntries.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {simpleEntries.map(([key, item]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-white/8 dark:bg-white/[0.03]">
                <div className={cn(`text-[11px] uppercase tracking-wide ${TEXT_TERTIARY_CLASS}`)}>{formatSnapshotLabel(key)}</div>
                <div className={cn(`mt-1 break-words text-xs font-medium ${TEXT_PRIMARY_CLASS}`)}>{formatSnapshotValue(item, isZh)}</div>
              </div>
            ))}
          </div>
        ) : null}
        {nestedEntries.slice(0, depth > 0 ? 2 : 4).map(([key, item]) => (
          <div key={key} className="space-y-2">
            <div className={cn(`text-[11px] font-semibold uppercase tracking-wide ${TEXT_TERTIARY_CLASS}`)}>{formatSnapshotLabel(key)}</div>
            {depth >= 1 && isPlainObject(item) ? (
              <div className={cn(`rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs ${TEXT_SECONDARY_CLASS} dark:border-white/8 dark:bg-white/[0.03]`)}>
                {Object.keys(item).length} {isZh ? '个字段' : 'fields'}
              </div>
            ) : (
              <ReadableSnapshot value={item} isZh={isZh} depth={depth + 1} />
            )}
          </div>
        ))}
        {nestedEntries.length > (depth > 0 ? 2 : 4) ? (
          <div className={cn(`text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
            {isZh ? `另有 ${nestedEntries.length - (depth > 0 ? 2 : 4)} 个分组` : `${nestedEntries.length - (depth > 0 ? 2 : 4)} more groups`}
          </div>
        ) : null}
        <RawJsonToggle value={value} isZh={isZh} />
      </div>
    );
  }

  return <div className={cn(`text-xs leading-6 ${TEXT_SECONDARY_CLASS}`)}>{formatSnapshotValue(value, isZh)}</div>;
}

function ResultSnapshot({ title, value, isZh }) {
  const hasValue = value != null && value !== '';
  const [open, setOpen] = useState(false);
  const displayValue = useMemo(
    () => (open && hasValue ? maskSensitiveValue(value) : value),
    [hasValue, open, value]
  );
  const summary = useMemo(() => {
    if (!hasValue) {
      return isZh ? '无结果' : 'No result';
    }

    if (Array.isArray(value)) {
      return isZh ? `数组 · ${value.length} 项` : `Array · ${value.length} items`;
    }

    if (typeof value === 'object') {
      const size = Object.keys(value).length;
      return isZh ? `对象 · ${size} 个字段` : `Object · ${size} fields`;
    }

    const text = typeof value === 'string' ? maskSensitiveString(value) : String(value);
    if (!text) {
      return isZh ? '无结果' : 'No result';
    }

    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > 56 ? `${compact.slice(0, 56)}...` : compact;
  }, [hasValue, isZh, value]);

  if (!hasValue) return null;

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/8 dark:bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className={cn(`text-[11px] uppercase tracking-[0.2em] ${TEXT_TERTIARY_CLASS}`)}>{title}</div>
          <div className={cn(`mt-2 truncate text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{summary}</div>
        </div>
        <span className={cn(
          `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${TEXT_SECONDARY_CLASS}`,
          'border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]'
        )}>
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          {open ? (isZh ? '收起' : 'Collapse') : (isZh ? '展开' : 'Expand')}
        </span>
      </button>
      {open ? <div className="mt-3"><ReadableSnapshot value={displayValue} isZh={isZh} /></div> : null}
    </div>
  );
}

function RunStepCard({ step, isZh }) {
  const status = step?.status || 'unknown';
  const tone = status === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100'
    : status === 'running'
      ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100'
      : status === 'waiting_approval' || status === 'waiting_input'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className={cn('rounded-[18px] border px-3 py-3 text-xs', tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 font-medium">
          <span className="font-mono text-[11px] opacity-70">#{step?.sequence ?? '-'}</span>
          <span className="ml-2">{step?.tool_name || step?.type || (isZh ? '步骤' : 'Step')}</span>
        </div>
        <Badge variant="outline" className="border-current/30 text-current">{status}</Badge>
      </div>
      {step?.approval_state || step?.rollback_state ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {step.approval_state ? <Badge variant="outline" className="border-current/20 text-current">{step.approval_state}</Badge> : null}
          {step.rollback_state ? <Badge variant="outline" className="border-current/20 text-current">{step.rollback_state}</Badge> : null}
        </div>
      ) : null}
      {step?.error_message ? <div className="mt-2 leading-5 opacity-80">{step.error_message}</div> : null}
    </div>
  );
}

function AgentStepTimelineCard({ item, locale, isZh, disabled, onRollback }) {
  const step = item?.step || {};
  const run = item?.run || {};
  const output = step?.output || {};
  const result = output?.result ?? null;
  const proposal = output?.proposal ?? null;
  const suggestion = output?.suggestion ?? null;
  const rollback = output?.meta?.rollback_available || null;
  const status = step?.status || 'unknown';
  const toolName = step.tool_name || step.type || (isZh ? '管理工具' : 'Admin tool');
  const statusTone = status === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100'
    : status === 'running'
      ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100'
      : status === 'waiting_approval' || status === 'waiting_input'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100';
  const resultSummary = result?.scope
    ? `${result.scope}${Number.isFinite(Number(result.total)) ? ` · ${result.total}` : ''}`
    : null;
  const messageSummary = item?.message?.kind === 'tool'
    ? item.message.content?.split('\n\n')[0] || (isZh ? '工具执行完成。' : 'Tool completed.')
    : item?.message?.content;

  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/8 dark:bg-white/[0.04]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <span className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', statusTone)}>
            {status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TerminalSquare className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn(`text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>
                {isZh ? '工具步骤' : 'Tool step'} #{step.sequence ?? '-'} · {toolName}
              </div>
              <Badge variant="outline" className="border-current/30 text-current">{status}</Badge>
              {step.approval_state ? <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-300/40 dark:text-amber-100">{step.approval_state}</Badge> : null}
              {step.rollback_state ? <Badge variant="outline" className="border-teal-300 text-teal-700 dark:border-teal-300/40 dark:text-teal-100">{step.rollback_state}</Badge> : null}
            </div>
            <div className={cn(`mt-2 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>
              {resultSummary || output?.assistant_text || messageSummary || (isZh ? '已记录工具输入、输出和运行状态。' : 'Tool input, output, and run state are recorded.')}
            </div>
            <div className={cn(`mt-2 flex flex-wrap gap-2 text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
              {step.step_id ? <span className="font-mono">{step.step_id}</span> : null}
              {run.run_id ? <span className="font-mono">{run.run_id}</span> : null}
              {step.duration_ms != null ? <span>{formatLatency(step.duration_ms, isZh)}</span> : null}
            </div>
          </div>
        </div>
        <div className={cn(`shrink-0 pt-1 text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
          {formatAbsoluteTime(step.started_at || item?.created_at, locale)}
        </div>
      </div>

      {step.error_message ? (
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
          {step.error_message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ResultSnapshot title={isZh ? '工具输入' : 'Tool input'} value={step.input} isZh={isZh} />
        <ResultSnapshot title={isZh ? '工具结果' : 'Tool result'} value={result} isZh={isZh} />
      </div>
      {proposal ? <ResultSnapshot title={isZh ? '确认提案' : 'Approval proposal'} value={proposal} isZh={isZh} /> : null}
      {suggestion ? <ResultSnapshot title={isZh ? '下一步建议' : 'Suggestion'} value={suggestion} isZh={isZh} /> : null}

      {rollback?.action_name && rollback?.payload ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-950 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-100">
          <div>
            <div className="font-medium">{isZh ? '可回滚' : 'Rollback available'}</div>
            <div className="mt-1 text-xs opacity-80">{rollback?.prompt_i18n?.[isZh ? 'zh' : 'en'] || rollback?.prompt}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="rounded-full border-current/30 text-current hover:bg-current/10"
            onClick={() => onRollback?.(rollback)}
          >
            {isZh ? '生成回滚卡' : 'Rollback'}
          </Button>
        </div>
      ) : null}
    </MotionDiv>
  );
}

function RunInspector({ runs, currentRun, isZh, locale }) {
  if (!currentRun) {
    return (
      <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
        {isZh ? '这条会话还没有 agent run。' : 'No agent run recorded for this session yet.'}
      </div>
    );
  }

  const steps = Array.isArray(currentRun.steps) ? currentRun.steps : [];
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className={cn(`font-mono text-[11px] ${TEXT_TERTIARY_CLASS}`)}>{currentRun.run_id}</div>
            <div className={cn(`mt-1 text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>
              {isZh ? '当前 Agent Run' : 'Current agent run'}
            </div>
          </div>
          <Badge variant="outline" className="border-slate-300 text-slate-700 dark:border-white/15 dark:text-slate-200">
            {currentRun.status || 'unknown'}
          </Badge>
        </div>
        <div className={cn(`mt-3 grid gap-2 text-xs ${TEXT_SECONDARY_CLASS} sm:grid-cols-2`)}>
          <div>{isZh ? '自主度' : 'Autonomy'}: {currentRun.autonomy_mode || 'read_only_auto'}</div>
          <div>{isZh ? '步骤' : 'Steps'}: {steps.length}</div>
          <div>{isZh ? '请求' : 'Request'}: {currentRun.request_id || '-'}</div>
          <div>{formatAbsoluteTime(currentRun.started_at, locale)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((step) => <RunStepCard key={step.step_id || step.id} step={step} isZh={isZh} />)}
      </div>
      {runs.length > 1 ? (
        <div className={cn(`text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
          {isZh ? `本会话共 ${runs.length} 个 run。` : `${runs.length} runs in this session.`}
        </div>
      ) : null}
    </div>
  );
}

function EventTimelineRow({ item, locale, isZh, t, disabled, onConfirmProposal, onRejectProposal, onRollback }) {
  const event = buildEventCopy(item, isZh, t);
  const proposal = item?.proposal;
  const metaData = item?.meta?.data || {};
  const decisionMeta = metaData.decision_meta || {};
  const rollback = decisionMeta.rollback_available || metaData.rollback_available || null;
  const rollbackPrompt = rollback?.prompt_i18n?.[isZh ? 'zh' : 'en'] || rollback?.prompt;
  const payload = proposal?.payload || metaData.request_payload || metaData.payload || null;
  const result = metaData.new_data || metaData.result || null;

  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 dark:border-white/8 dark:bg-black/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <span className={cn(
            'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
            event.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.12] dark:text-emerald-200',
            event.tone === 'proposal' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/[0.12] dark:text-amber-100',
            event.tone === 'failed' && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.12] dark:text-rose-100',
            event.tone === 'tool' && 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/[0.12] dark:text-sky-100',
            event.tone === 'muted' && 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
          )}>
            {item?.kind === 'tool'
              ? <TerminalSquare className="h-4 w-4" />
              : item?.kind === 'action_proposed'
                ? <ShieldAlert className="h-4 w-4" />
                : <ShieldCheck className="h-4 w-4" />}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn(`text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>{event.title}</div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                {getLocalizedEventKind(item?.kind, isZh)}
              </span>
            </div>
            <div className={cn(`mt-2 text-xs leading-6 ${TEXT_SECONDARY_CLASS}`)}>{event.description}</div>
          </div>
        </div>
        <div className={cn(`shrink-0 pt-1 text-[11px] ${TEXT_TERTIARY_CLASS}`)}>{formatAbsoluteTime(item?.created_at, locale)}</div>
      </div>

      {payload ? <JsonPreview value={payload} className="mt-4" /> : null}
      {result ? <JsonPreview value={result} className="mt-3" /> : null}

      {proposal?.proposal_id && proposal?.status === 'pending' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={disabled}
            className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            onClick={() => onConfirmProposal(proposal.proposal_id)}
          >
            {isZh ? '确认执行' : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className={OUTLINE_BUTTON_CLASS}
            onClick={() => onRejectProposal(proposal.proposal_id)}
          >
            {isZh ? '驳回' : 'Reject'}
          </Button>
        </div>
      ) : null}
      {rollback?.action_name && rollback?.payload ? (
        <div className="mt-4 rounded-[18px] border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-950 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-medium">{isZh ? '可回滚' : 'Rollback available'}</div>
              <div className="mt-1 text-xs leading-5 opacity-80">
                {rollbackPrompt || (isZh ? '将生成一张反向操作确认卡。' : 'Creates a reverse-action approval card.')}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className="shrink-0 rounded-full border-current/30 text-current hover:bg-current/10"
              onClick={() => onRollback?.(rollback)}
            >
              {isZh ? '生成回滚卡' : 'Rollback'}
            </Button>
          </div>
        </div>
      ) : null}
    </MotionDiv>
  );
}

function LlmCallCard({ item, locale, isZh }) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/80 p-4 dark:border-white/8 dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(`flex items-center gap-2 text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>
            <Cpu className="h-4 w-4 text-sky-600 dark:text-sky-200" />
            {isZh ? `模型回合 #${item.turn_no || '--'}` : `Model turn #${item.turn_no || '--'}`}
          </div>
          <div className={cn(`mt-1 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>{item.model || '--'}</div>
        </div>
        <span className={cn(
          'rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]',
          item.status === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/[0.12] dark:text-emerald-100'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/[0.12] dark:text-rose-100'
        )}>
          {getLocalizedCallStatus(item.status, isZh)}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/6 dark:bg-black/20">
          <div className={cn(`text-[10px] uppercase tracking-[0.18em] ${TEXT_TERTIARY_CLASS}`)}>{isZh ? '令牌' : 'Tokens'}</div>
          <div className={cn(`mt-2 text-lg font-semibold ${TEXT_PRIMARY_CLASS}`)}>{formatCompactNumber(item.total_tokens)}</div>
        </div>
        <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/6 dark:bg-black/20">
          <div className={cn(`text-[10px] uppercase tracking-[0.18em] ${TEXT_TERTIARY_CLASS}`)}>{isZh ? '延迟' : 'Latency'}</div>
          <div className={cn(`mt-2 text-lg font-semibold ${TEXT_PRIMARY_CLASS}`)}>{formatLatency(item.latency_ms, isZh)}</div>
        </div>
      </div>
      <div className={cn(`mt-3 flex items-center justify-between gap-3 text-[11px] ${TEXT_TERTIARY_CLASS}`)}>
        <span>{formatAbsoluteTime(item.created_at, locale)}</span>
        <span className="truncate font-mono">{item.request_id || '--'}</span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  locale,
  isZh,
  t,
  disabled,
  onNavigateSuggestion,
  onConfirmProposal,
  onRejectProposal,
}) {
  const isUser = message?.role === 'user';
  const suggestion = message?.meta?.data?.suggestion;
  const proposal = message?.proposal || message?.meta?.data?.proposal;
  const result = message?.meta?.data?.result;
  const actionName = message?.meta?.data?.meta?.action_name || null;
  const missing = Array.isArray(message?.meta?.data?.meta?.missing) ? message.meta.data.meta.missing : [];
  const messageWidthClass = 'w-full max-w-[min(100%,36rem)]';
  const messageContent = !isUser
    ? translateI18nMessage(t, getMessageI18nPayload(message), message?.content)
    : message?.content;

  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col gap-3', isUser ? 'items-end' : 'items-start')}
    >
      <div className={cn(messageWidthClass, 'space-y-3')}>
        <div className={cn(
          `flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] ${TEXT_TERTIARY_CLASS}`,
          isUser ? 'justify-end' : 'justify-start'
        )}>
          <span className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border',
            isUser
              ? 'order-2 border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/18 dark:bg-emerald-400/[0.12] dark:text-emerald-200'
          )}>
            {isUser ? <MessageSquare className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </span>
          <span className={isUser ? 'order-1' : ''}>{isUser ? (isZh ? '管理员' : 'Admin') : 'CarbonTrack AI'}</span>
          {message?.created_at ? <span className={cn('normal-case tracking-normal', isUser ? 'order-1' : '')}>{formatAbsoluteTime(message.created_at, locale)}</span> : null}
        </div>

        <div className={cn(
          'break-words rounded-[24px] border px-5 py-4 text-sm leading-7 shadow-[0_12px_30px_rgba(0,0,0,0.18)]',
          isUser
            ? 'rounded-tr-lg border-slate-200 bg-white text-slate-900 dark:border-white/12 dark:bg-white/[0.08] dark:text-white'
            : 'rounded-tl-lg border-emerald-200 bg-emerald-50/85 text-slate-800 dark:border-emerald-400/14 dark:bg-emerald-400/[0.08] dark:text-slate-100'
        )}>
          {messageContent ? (
            isUser
              ? <div className="whitespace-pre-wrap">{messageContent}</div>
              : <AdminAiMarkdown content={messageContent} />
          ) : t('admin.aiWorkspace.stream.noAssistantText', { defaultValue: isZh ? 'AI 未返回文本。' : 'No assistant text returned.' })}
        </div>

        {!isUser && (actionName || result || missing.length > 0) ? (
          <div className="grid gap-3">
            {actionName ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/[0.12] dark:text-sky-100">
                <Activity className="h-3.5 w-3.5" />
                {getLocalizedActionLabel({ name: actionName }, isZh)}
              </div>
            ) : null}
            {missing.length > 0 ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700 dark:border-amber-400/18 dark:bg-amber-400/[0.10] dark:text-amber-50">
                {isZh ? '缺少字段：' : 'Missing fields: '}
                {missing.map((item) => item.field).join(', ')}
              </div>
            ) : null}
            {result ? <ResultSnapshot title={isZh ? '结果快照' : 'Result snapshot'} value={result} isZh={isZh} /> : null}
          </div>
        ) : null}

        {suggestion?.route ? (
          <button
            type="button"
            onClick={() => onNavigateSuggestion(suggestion)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.08]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {getLocalizedRouteLabel(suggestion.route, isZh, suggestion.label)}
          </button>
        ) : null}

        {proposal?.proposal_id && proposal?.status === 'pending' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled}
              className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={() => onConfirmProposal(proposal.proposal_id)}
            >
              {isZh ? '确认执行' : 'Confirm'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={OUTLINE_BUTTON_CLASS}
              onClick={() => onRejectProposal(proposal.proposal_id)}
            >
              {isZh ? '驳回' : 'Reject'}
            </Button>
          </div>
        ) : null}
      </div>
    </MotionDiv>
  );
}

function EmptyConversationState({ isZh, starterPrompts, onUsePrompt, onNavigateAudit }) {
  return (
    <div className="flex h-full items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/18 dark:bg-emerald-400/[0.12] dark:text-emerald-200">
            <Command className="h-9 w-9" />
          </div>
          <h3 className={cn(`mt-6 text-3xl font-semibold tracking-tight ${TEXT_PRIMARY_CLASS}`)}>
            {isZh ? '从一个明确任务开始' : 'Start from a clear task'}
          </h3>
          <p className={cn(`mt-3 text-sm leading-7 ${TEXT_SECONDARY_CLASS}`)}>
            {isZh
              ? '这不是宣传页，也不是摘要墙。直接输入目标、对象与范围，让工作台生成查询、建议或待确认动作。'
              : 'This surface is for action. State the target, subject, and scope, then let the workspace draft queries, suggestions, or confirmation-ready proposals.'}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {starterPrompts.slice(0, 4).map((item) => (
            <PromptButton key={item.id} label={item.label} prompt={item.prompt} onUse={onUsePrompt} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onNavigateAudit}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.08]"
          >
            <History className="h-4 w-4" />
            {isZh ? '查看会话审计' : 'Open session audit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAiWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const composerRef = useRef(null);
  const [searchParams] = useSearchParams();
  const { currentLanguage, t } = useTranslation('admin');

  const currentAdminId = useMemo(() => {
    const user = userManager.getUser();
    return user?.id ?? null;
  }, []);

  const locale = currentLanguage || 'zh-CN';
  const isZh = locale.toLowerCase().startsWith('zh');

  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [draft, setDraft] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [workspaceSection, setWorkspaceSection] = useState('actions');
  const [streamState, setStreamState] = useState(createEmptyStreamState);
  const [streamConversationId, setStreamConversationId] = useState(null);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible'
  );
  const [autonomyMode, setAutonomyMode] = useState('read_only_auto');
  const selectedConversationIdRef = useRef(selectedConversationId);
  const isCreatingConversationRef = useRef(isCreatingConversation);
  const optimisticMessageSequenceRef = useRef(0);
  const streamItemSequenceRef = useRef(0);

  const aiContext = useMemo(() => ({
    activeRoute: '/admin/ai',
    locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
    autonomyMode,
  }), [autonomyMode, locale]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    isCreatingConversationRef.current = isCreatingConversation;
  }, [isCreatingConversation]);

  const workspaceQuery = useQuery(
    ['adminAiWorkspace'],
    async () => {
      const response = await adminAPI.getAiWorkspace();
      return response.data?.data || response.data;
    }
  );

  const conversationsQuery = useQuery(
    ['adminAiConversations', currentAdminId],
    async () => {
      const response = await adminAPI.getAiConversations({
        limit: 24,
        admin_id: currentAdminId || undefined,
      });
      return response.data?.data || [];
    },
    {
      keepPreviousData: true,
    }
  );

  const conversationItems = useMemo(() => {
    if (Array.isArray(conversationsQuery.data) && conversationsQuery.data.length > 0) {
      return conversationsQuery.data;
    }

    return Array.isArray(workspaceQuery.data?.recent_conversations) ? workspaceQuery.data.recent_conversations : [];
  }, [conversationsQuery.data, workspaceQuery.data?.recent_conversations]);

  const filteredConversationItems = useMemo(() => {
    const keyword = conversationSearch.trim().toLowerCase();

    return conversationItems.filter((item) => {
      if (conversationFilter === 'pending' && Number(item?.pending_action_count || 0) <= 0) {
        return false;
      }

      if (conversationFilter === 'active' && Number(item?.pending_action_count || 0) > 0) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        item?.title,
        item?.last_message_preview,
        item?.conversation_id,
        item?.last_model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [conversationFilter, conversationItems, conversationSearch]);

  useEffect(() => {
    if (!selectedConversationId && !isCreatingConversation && filteredConversationItems.length > 0) {
      setSelectedConversationId(filteredConversationItems[0].conversation_id);
    }
  }, [filteredConversationItems, isCreatingConversation, selectedConversationId]);

  useEffect(() => {
    if (
      streamConversationId
      && conversationItems.some((item) => String(item.conversation_id) === String(streamConversationId))
    ) {
      setStreamConversationId(null);
    }
  }, [conversationItems, streamConversationId]);

  useEffect(() => {
    if (isCreatingConversation || !selectedConversationId) {
      return;
    }

    const stillVisible = filteredConversationItems.some((item) => String(item.conversation_id) === String(selectedConversationId));
    const streamConversationPendingInList = streamConversationId != null
      && !conversationItems.some((item) => String(item.conversation_id) === String(streamConversationId));
    if (
      !stillVisible
      && streamConversationId != null
      && streamConversationPendingInList
      && String(selectedConversationId) === String(streamConversationId)
    ) {
      return;
    }
    if (!stillVisible && filteredConversationItems.length > 0) {
      setSelectedConversationId(filteredConversationItems[0].conversation_id);
    }
  }, [conversationItems, filteredConversationItems, isCreatingConversation, selectedConversationId, streamConversationId]);

  useEffect(() => {
    if (searchParams.get('focus') === 'composer') {
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const updateVisibility = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const hasLocalStreamItems = Boolean(streamState.optimisticMessage)
    || (Array.isArray(streamState.items) && streamState.items.some(isActiveStreamItem));
  const shouldPollCurrentConversation = Boolean(selectedConversationId)
    && !isCreatingConversation
    && !hasLocalStreamItems
    && isDocumentVisible;

  const conversationDetailQuery = useQuery(
    ['adminAiConversation', selectedConversationId],
    async () => {
      const response = await adminAPI.getAiConversation(selectedConversationId);
      return response.data?.data || response.data;
    },
    {
      enabled: Boolean(selectedConversationId),
      refetchOnWindowFocus: true,
      refetchInterval: shouldPollCurrentConversation ? CURRENT_CONVERSATION_POLL_INTERVAL_MS : false,
    }
  );

  const activeConversation = isCreatingConversation ? null : (conversationDetailQuery.data || null);
  const activeConversationId = activeConversation?.conversation_id == null ? null : String(activeConversation.conversation_id);
  const normalizedSelectedConversationId = selectedConversationId == null ? null : String(selectedConversationId);

  const conversationTimeline = useMemo(
    () => buildConversationTimeline(activeConversation),
    [activeConversation]
  );
  const visibleMessages = useMemo(
    () => conversationTimeline.filter((item) => item?.kind === 'message'),
    [conversationTimeline]
  );
  const shouldRenderOptimisticMessage = useMemo(() => {
    const optimisticMessage = streamState.optimisticMessage;
    if (!optimisticMessage) {
      return false;
    }

    const optimisticContent = String(optimisticMessage.content || optimisticMessage.message || '').trim();
    if (!optimisticContent) {
      return true;
    }
    const baselineUserMessageMatches = Number(
      optimisticMessage.meta?.data?.baseline_user_message_matches ?? 0
    );
    let currentUserMessageMatches = 0;

    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message?.role !== 'user') {
        continue;
      }

      if (String(message.content || message.message || '').trim() === optimisticContent) {
        currentUserMessageMatches += 1;
      }
    }

    return currentUserMessageMatches <= baselineUserMessageMatches;
  }, [streamState.optimisticMessage, visibleMessages]);
  const pendingActions = useMemo(
    () => (Array.isArray(activeConversation?.pending_actions) ? activeConversation.pending_actions : []),
    [activeConversation]
  );
  const llmCalls = useMemo(
    () => (Array.isArray(activeConversation?.llm_calls) ? activeConversation.llm_calls : []),
    [activeConversation]
  );
  const conversationRuns = useMemo(
    () => (Array.isArray(activeConversation?.runs) ? activeConversation.runs : []),
    [activeConversation]
  );
  const currentRun = conversationRuns.length > 0 ? conversationRuns[conversationRuns.length - 1] : null;

  const invalidateWorkspace = useCallback(() => {
    queryClient.invalidateQueries(['adminAiWorkspace']);
    queryClient.invalidateQueries(['adminAiConversations', currentAdminId]);
  }, [currentAdminId, queryClient]);

  const invalidateConversationDetail = useCallback((conversationId) => {
    const targetConversationId = conversationId ?? selectedConversationId;
    if (targetConversationId != null) {
      queryClient.invalidateQueries(['adminAiConversation', targetConversationId]);
      return;
    }

    queryClient.invalidateQueries(['adminAiConversation']);
  }, [queryClient, selectedConversationId]);

  const hasStaleConversationDetail = Boolean(normalizedSelectedConversationId)
    && activeConversationId !== normalizedSelectedConversationId;

  const handleStreamEvent = useCallback(({ event, data }) => {
    streamItemSequenceRef.current += 1;
    const eventData = data && typeof data === 'object'
      ? { ...data, _client_sequence: streamItemSequenceRef.current }
      : data;

    if (event === 'run.started' && eventData?.conversation_id) {
      const nextConversationId = eventData.conversation_id;
      const eventConversationId = String(nextConversationId);
      const latestSelectedConversationId = selectedConversationIdRef.current == null
        ? null
        : String(selectedConversationIdRef.current);
      const shouldSelectStreamConversation = (
        isCreatingConversationRef.current
        || latestSelectedConversationId == null
        || latestSelectedConversationId === eventConversationId
      );

      setStreamConversationId(nextConversationId);
      if (shouldSelectStreamConversation) {
        selectedConversationIdRef.current = nextConversationId;
        setSelectedConversationId(nextConversationId);
      }
      isCreatingConversationRef.current = false;
      setIsCreatingConversation(false);
      queryClient.invalidateQueries(['adminAiConversations', currentAdminId]);
      invalidateConversationDetail(nextConversationId);
    }
    setStreamState((state) => reduceStreamState(state, event, eventData));
  }, [currentAdminId, invalidateConversationDetail, queryClient]);

  const sendMutation = useMutation(
    async ({ message, conversationId }) => {
      try {
        const payload = await streamAdminAiChat({
          conversation_id: conversationId || undefined,
          message,
          context: aiContext,
          source: 'admin:/admin/ai',
        }, handleStreamEvent);
        return { data: payload };
      } catch (error) {
        const status = error?.response?.status;
        const contentType = error?.response?.headers?.['content-type'] || '';
        const shouldFallbackToJson =
          status === 404 ||
          status === 406 ||
          status === 415 ||
          status === 501 ||
          (!!contentType && !contentType.toLowerCase().includes('text/event-stream'));

        if (!shouldFallbackToJson) {
          throw error;
        }

        const fallbackResponse = await adminAPI.chatWithAdminAi({
          conversation_id: conversationId || undefined,
          message,
          context: aiContext,
          source: 'admin:/admin/ai',
        });
        return fallbackResponse;
      }
    },
    {
      onMutate: (variables) => {
        const optimisticContent = String(variables.message || '').trim();
        const baselineUserMessageMatches = visibleMessages.reduce((count, message) => {
          if (
            message?.role === 'user'
            && String(message.content || message.message || '').trim() === optimisticContent
          ) {
            return count + 1;
          }
          return count;
        }, 0);

        setStreamState({
          optimisticMessage: createOptimisticUserMessage(
            variables.message,
            variables.conversationId,
            baselineUserMessageMatches,
            optimisticMessageSequenceRef.current += 1
          ),
          items: [],
        });
      },
      onSuccess: (response, variables) => {
        const payload = response.data || {};
        const nextConversation = buildFallbackConversation(
          payload.conversation || null,
          payload.conversation_id || variables.conversationId || null,
          activeConversation,
          variables.message,
          payload.message || null,
          normalizeI18nMessagePayload(payload.message_i18n || payload.metadata?.message_i18n)
        );
        const nextConversationId = payload.conversation_id || nextConversation?.conversation_id || null;
        const latestSelectedConversationId = selectedConversationIdRef.current == null
          ? null
          : String(selectedConversationIdRef.current);
        const requestConversationId = variables?.conversationId == null
          ? null
          : String(variables.conversationId);
        const normalizedNextConversationId = nextConversationId == null ? null : String(nextConversationId);

        if (nextConversationId) {
          queryClient.setQueryData(['adminAiConversation', nextConversationId], nextConversation);
          const shouldSelectNextConversation = (
            isCreatingConversationRef.current
            || latestSelectedConversationId == null
            || latestSelectedConversationId === normalizedNextConversationId
            || latestSelectedConversationId === requestConversationId
          );
          if (shouldSelectNextConversation) {
            selectedConversationIdRef.current = nextConversationId;
            setSelectedConversationId(nextConversationId);
          }
        }

        isCreatingConversationRef.current = false;
        setIsCreatingConversation(false);
        setStreamConversationId(nextConversationId || null);
        setStreamState(createEmptyStreamState());
        setDraft((current) => (current.trim() === variables.message ? '' : current));
        invalidateConversationDetail(nextConversationId || variables?.conversationId);
        invalidateWorkspace();
      },
      onError: (error, variables) => {
        setStreamState((state) => preserveStreamDiagnosticsAfterError(state, error));
        setStreamConversationId(null);
        invalidateWorkspace();
        invalidateConversationDetail(variables?.conversationId);
        if (error?.code === 'AI_STREAM_DISCONNECTED') {
          toast.error(isZh ? 'AI 连接中断，正在恢复会话记录。' : 'AI stream disconnected. Restoring the session timeline.');
          return;
        }
        if (error?.code === 'AI_PROVIDER_TIMEOUT' || error?.response?.data?.code === 'AI_PROVIDER_TIMEOUT') {
          toast.error(isZh ? '模型处理超时，可能请求过复杂，请拆分任务或稍后重试。' : 'The model timed out. Try splitting the task or retry later.');
          return;
        }
        toast.error(error?.response?.data?.error || error?.message || (isZh ? 'AI 请求失败，请稍后重试。' : 'AI request failed. Please try again.'));
      },
    }
  );

  const decisionMutation = useMutation(
    async ({ proposalId, outcome, conversationId, rollback }) => {
      setStreamState(createEmptyStreamState());
      const decisionPayload = {
        proposal_id: proposalId,
        outcome,
        ...(rollback ? { rollback } : {}),
      };
      const requestPayload = {
        conversation_id: conversationId,
        context: aiContext,
        decision: decisionPayload,
        source: 'admin:/admin/ai',
      };
      try {
        const payload = await streamAdminAiChat(requestPayload, handleStreamEvent);
        return { data: payload };
      } catch (error) {
        const status = error?.response?.status;
        const contentType = error?.response?.headers?.['content-type'] || '';
        const shouldFallbackToJson =
          status === 404 ||
          status === 406 ||
          status === 415 ||
          status === 501 ||
          (!!contentType && !contentType.toLowerCase().includes('text/event-stream'));

        if (!shouldFallbackToJson) {
          throw error;
        }

        setStreamState(createEmptyStreamState());
        return adminAPI.chatWithAdminAi(requestPayload);
      }
    },
    {
      onSuccess: (response, variables) => {
        const payload = response.data || {};
        const previousConversation = variables?.conversationId
          ? queryClient.getQueryData(['adminAiConversation', variables.conversationId])
          : null;
        const nextConversation = buildFallbackConversation(
          payload.conversation || null,
          payload.conversation_id || variables?.conversationId || null,
          previousConversation,
          null,
          payload.message || null,
          normalizeI18nMessagePayload(payload.message_i18n || payload.metadata?.message_i18n)
        );
        const nextConversationId = payload.conversation_id || variables?.conversationId || null;

        if (nextConversationId) {
          queryClient.setQueryData(['adminAiConversation', nextConversationId], nextConversation);
        }

        invalidateWorkspace();
        invalidateConversationDetail(nextConversationId || variables?.conversationId);
        setStreamConversationId(nextConversationId || variables?.conversationId || null);
        setStreamState(createEmptyStreamState());
      },
      onError: (error, variables) => {
        setStreamState((state) => preserveStreamDiagnosticsAfterError(state, error));
        setStreamConversationId(null);
        invalidateWorkspace();
        invalidateConversationDetail(variables?.conversationId);
        if (error?.code === 'AI_PROVIDER_TIMEOUT' || error?.response?.data?.code === 'AI_PROVIDER_TIMEOUT') {
          toast.error(isZh ? '模型处理超时，可能请求过复杂，请拆分任务或稍后重试。' : 'The model timed out. Try splitting the task or retry later.');
          return;
        }
        toast.error(error?.response?.data?.error || error?.message || (isZh ? '操作决策失败。' : 'Decision failed.'));
      },
    }
  );

  const workspaceData = workspaceQuery.data;
  const assistant = workspaceData?.assistant || EMPTY_OBJECT;
  const starterPrompts = useMemo(
    () => (Array.isArray(workspaceData?.starter_prompts) ? workspaceData.starter_prompts : EMPTY_ARRAY),
    [workspaceData?.starter_prompts]
  );
  const quickActions = useMemo(
    () => (Array.isArray(workspaceData?.quick_actions) ? workspaceData.quick_actions : EMPTY_ARRAY),
    [workspaceData?.quick_actions]
  );
  const navigationTargets = useMemo(
    () => (Array.isArray(workspaceData?.navigation_targets) ? workspaceData.navigation_targets : EMPTY_ARRAY),
    [workspaceData?.navigation_targets]
  );
  const managementActions = useMemo(
    () => (Array.isArray(workspaceData?.management_actions) ? workspaceData.management_actions : EMPTY_ARRAY),
    [workspaceData?.management_actions]
  );

  const currentSummary = activeConversation?.summary
    || conversationItems.find((item) => String(item.conversation_id) === String(selectedConversationId))
    || {};
  const selectedConversationTitle = currentSummary.title || (isCreatingConversation ? (isZh ? '新会话' : 'New session') : (isZh ? '控制通道' : 'Control channel'));
  const currentConversationIdLabel = activeConversationId || normalizedSelectedConversationId || null;
  const lastActivityLabel = formatAbsoluteTime(currentSummary.last_activity_at, locale);
  const canSend = draft.trim().length >= COMMAND_MIN_LENGTH && !sendMutation.isLoading && assistant.chat_enabled !== false;
  const canCreateConversation = !sendMutation.isLoading && !decisionMutation.isLoading;
  const disableProposalActions = decisionMutation.isLoading || hasStaleConversationDetail;
  const autonomyOptions = useMemo(() => ([
    {
      id: 'read_only_auto',
      label: isZh ? '只读自动' : 'Read only',
      description: isZh ? '写操作全部确认' : 'Confirm all writes',
    },
    {
      id: 'low_risk_auto',
      label: isZh ? '低风险自动' : 'Low risk',
      description: isZh ? '仅自动执行可回滚低风险动作' : 'Auto-run reversible low-risk writes',
    },
    {
      id: 'full_auto',
      label: isZh ? '全自动' : 'Full auto',
      description: isZh ? '按后台策略自动执行' : 'Follow backend policy',
    },
  ]), [isZh]);

  const capabilitySummary = useMemo(() => ({
    readCount: managementActions.filter((item) => item.risk_level === 'read').length,
    writeCount: managementActions.filter((item) => item.risk_level === 'write').length,
    confirmationCount: managementActions.filter((item) => item.requires_confirmation).length,
  }), [managementActions]);

  const spotlightRoutes = useMemo(() => quickActions.slice(0, 4), [quickActions]);
  const sideRoutes = useMemo(() => navigationTargets.filter((item) => item.route !== '/admin/ai').slice(0, 6), [navigationTargets]);
  const capabilityPreview = useMemo(() => managementActions.slice(0, 6), [managementActions]);
  const localizedSpotlightRoutes = useMemo(
    () => spotlightRoutes.map((action) => ({ ...action, ...getLocalizedQuickActionCopy(action, isZh) })),
    [isZh, spotlightRoutes]
  );
  const localizedSideRoutes = useMemo(
    () => sideRoutes.map((target) => ({ ...target, ...getLocalizedNavigationCopy(target, isZh) })),
    [isZh, sideRoutes]
  );
  const taskTemplates = useMemo(
    () => managementActions
      .slice(0, 8)
      .map((action) => ({
        ...action,
        localizedLabel: getLocalizedActionLabel(action, isZh),
        prompt: action.risk_level === 'write'
          ? `${isZh ? '请帮我准备一个待确认操作：' : 'Prepare a confirmation-ready operation for '} ${getLocalizedActionLabel(action, isZh)}${action.requirements?.length ? `；${isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${action.requirements.join(', ')}` : ''}`
          : `${isZh ? '请帮我执行查询：' : 'Run this query: '} ${getLocalizedActionLabel(action, isZh)}${action.requirements?.length ? `；${isZh ? '如缺字段请直接追问：' : 'ask follow-up for: '}${action.requirements.join(', ')}` : ''}`,
      })),
    [isZh, managementActions]
  );
  const latestAssistantResult = useMemo(() => {
    const assistantMessages = [...visibleMessages].reverse();
    return assistantMessages.find((item) => item?.meta?.data?.result)?.meta?.data?.result || null;
  }, [visibleMessages]);
  const resultFollowUps = useMemo(() => {
    if (!latestAssistantResult || typeof latestAssistantResult !== 'object') {
      return [];
    }

    if (latestAssistantResult.scope === 'pending_carbon_records' && Array.isArray(latestAssistantResult.items) && latestAssistantResult.items.length > 0) {
      const ids = latestAssistantResult.items.slice(0, 5).map((item) => item.id).filter(Boolean);
      if (ids.length === 0) return [];

      return [
        {
          id: 'approve-pending-result',
          label: isZh ? '基于结果准备批量通过' : 'Prepare approval from result',
          description: isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认通过动作。' : 'Turn the first five pending records into a confirmation-ready approval action.',
          prompt: `请准备一个待确认操作：批量通过这些碳记录，record_ids=${ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
        {
          id: 'reject-pending-result',
          label: isZh ? '基于结果准备批量驳回' : 'Prepare rejection from result',
          description: isZh ? '把当前结果里的前 5 条待审记录直接组装成待确认驳回动作。' : 'Turn the first five pending records into a confirmation-ready rejection action.',
          prompt: `请准备一个待确认操作：批量驳回这些碳记录，record_ids=${ids.join(', ')}。如果需要 review_note，请先问我。`,
        },
      ];
    }

    return [];
  }, [isZh, latestAssistantResult]);
  const inspectorSummary = useMemo(() => {
    const messageCount = currentSummary.message_count || 0;
    const llmCount = currentSummary.llm_calls || 0;
    const stepCount = conversationRuns.reduce((sum, run) => sum + (Array.isArray(run?.steps) ? run.steps.length : 0), 0);
    const pendingLabel = pendingActions.length > 0
      ? `${pendingActions.length}${isZh ? ' 个待确认动作' : ' pending actions'}`
      : (isZh ? '无挂起动作' : 'No pending action');
    const latestScope = latestAssistantResult?.scope
      ? `${isZh ? '最近结果' : 'Latest result'}: ${getLocalizedScopeLabel(latestAssistantResult.scope, isZh)}`
      : null;

    return {
      title: isZh
        ? `${messageCount} 条消息，${llmCount} 次模型调用`
        : `${messageCount} messages, ${llmCount} model turns`,
      detail: latestScope ? `${pendingLabel} · ${stepCount} steps · ${latestScope}` : `${pendingLabel} · ${stepCount} steps`,
    };
  }, [conversationRuns, currentSummary.llm_calls, currentSummary.message_count, isZh, latestAssistantResult?.scope, pendingActions.length]);
  const secondarySections = useMemo(() => ([
    {
      id: 'actions',
      label: isZh ? '执行面板' : 'Action deck',
      icon: ShieldCheck,
      count: pendingActions.length + resultFollowUps.length,
      description: isZh ? '处理待确认动作与基于结果的下一步。' : 'Handle confirmations and next-step suggestions.',
    },
    {
      id: 'shortcuts',
      label: isZh ? '快捷入口' : 'Shortcuts',
      icon: Sparkles,
      count: localizedSpotlightRoutes.length + localizedSideRoutes.length,
      description: isZh ? '直接跳到高频后台页或人工处理入口。' : 'Jump to common admin surfaces and manual follow-ups.',
    },
    {
      id: 'inspector',
      label: isZh ? '会话检查' : 'Inspector',
      icon: Cpu,
      count: llmCalls.length + conversationRuns.length,
      description: isZh ? '查看模型回合、结果快照与会话强度。' : 'Inspect model turns, snapshots, and session density.',
    },
    {
      id: 'capabilities',
      label: isZh ? '工具目录' : 'Capabilities',
      icon: Command,
      count: capabilityPreview.length + Math.min(taskTemplates.length, 5),
      description: isZh ? '查看能力边界与更稳的任务模板。' : 'Review guardrails and reliable task templates.',
    },
  ]), [capabilityPreview.length, conversationRuns.length, isZh, llmCalls.length, localizedSideRoutes.length, localizedSpotlightRoutes.length, pendingActions.length, resultFollowUps.length, taskTemplates.length]);
  const currentSection = secondarySections.find((item) => item.id === workspaceSection) || secondarySections[0];

  const handleSelectConversation = useCallback((conversationId) => {
    isCreatingConversationRef.current = false;
    selectedConversationIdRef.current = conversationId;
    setIsCreatingConversation(false);
    setSelectedConversationId(conversationId);
    setStreamConversationId(null);
    setStreamState(createEmptyStreamState());
  }, []);

  const handleUsePrompt = useCallback((prompt) => {
    setDraft(prompt);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const handleStartConversation = useCallback(() => {
    isCreatingConversationRef.current = true;
    selectedConversationIdRef.current = null;
    setIsCreatingConversation(true);
    setSelectedConversationId(null);
    setStreamConversationId(null);
    setStreamState(createEmptyStreamState());
    queryClient.removeQueries(['adminAiConversation']);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [queryClient]);

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (message.length < COMMAND_MIN_LENGTH || sendMutation.isLoading || assistant.chat_enabled === false) {
      return;
    }

    sendMutation.mutate({
      message,
      conversationId: isCreatingConversation ? null : selectedConversationId,
    });
  }, [assistant.chat_enabled, draft, isCreatingConversation, selectedConversationId, sendMutation]);

  const handleComposerKeyDown = useCallback((event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNavigateSuggestion = useCallback((suggestion) => {
    const fullRoute = buildRouteWithQuery(suggestion?.route, suggestion?.query || {});
    if (!fullRoute) {
      toast.error(isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    navigate(fullRoute);
  }, [isZh, navigate]);

  const handleRunQuickAction = useCallback((action) => {
    const fullRoute = buildRouteWithQuery(action?.route, action?.query || {});
    if (!fullRoute) {
      toast.error(isZh ? '缺少可跳转的目标页面。' : 'Missing destination route.');
      return;
    }

    navigate(fullRoute);
  }, [isZh, navigate]);

  const handleNavigateAudit = useCallback(() => {
    navigate('/admin/llm-usage');
  }, [navigate]);

  const handleCreateRollback = useCallback((rollback) => {
    if (!normalizedSelectedConversationId || !rollback?.action_name || !rollback?.payload) {
      toast.error(isZh ? '缺少可回滚的操作数据。' : 'Missing rollback data.');
      return;
    }

    decisionMutation.mutate({
      proposalId: rollback.source_proposal_id || 0,
      outcome: 'rollback',
      conversationId: normalizedSelectedConversationId,
      rollback,
    });
  }, [decisionMutation, isZh, normalizedSelectedConversationId]);

  const busyLabel = sendMutation.isLoading
    ? (isZh ? '正在请求模型...' : 'Sending to model...')
    : decisionMutation.isLoading
      ? (isZh ? '正在写回决策...' : 'Applying decision...')
      : conversationDetailQuery.isFetching && !isCreatingConversation
        ? (isZh ? '同步会话中...' : 'Syncing session...')
        : null;

  return (
    <div className="min-w-0 overflow-x-clip pb-4">
      <div className="relative w-full min-w-0 overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.12)] dark:border-slate-900 dark:bg-[#060816] dark:text-white dark:shadow-[0_30px_90px_rgba(2,6,23,0.48)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,249,0.92))] dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,rgba(12,16,36,0.96),rgba(5,8,22,1))]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="relative">
          <div className={`border-b px-6 py-6 md:px-8 ${PANEL_DIVIDER_CLASS}`}>
            <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]">
              <div className="min-w-0 space-y-4 lg:col-span-2 2xl:col-span-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone="success">
                    <Bot className="h-3.5 w-3.5" />
                    {isZh ? '管理 AI' : 'Admin AI'}
                  </StatusChip>
                  <StatusChip tone={assistant.chat_enabled ? 'success' : 'warning'}>
                    {assistant.chat_enabled ? (isZh ? '对话已就绪' : 'Chat ready') : (isZh ? '对话不可用' : 'Chat unavailable')}
                  </StatusChip>
                  <StatusChip tone={assistant.intent_enabled ? 'success' : 'warning'}>
                    {assistant.intent_enabled ? (isZh ? '意图解析在线' : 'Intent online') : (isZh ? '意图解析关闭' : 'Intent offline')}
                  </StatusChip>
                </div>

                <div>
                  <div className={cn(`text-[11px] uppercase tracking-[0.32em] ${TEXT_TERTIARY_CLASS}`)}>
                    {isZh ? '治理工作面' : 'Operations surface'}
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    {isZh ? '管理 AI 指挥台' : 'Admin AI cockpit'}
                  </h2>
                </div>
              </div>

              <MetricTile
                label={isZh ? '读取能力' : 'Read ops'}
                value={capabilitySummary.readCount}
                hint={isZh ? '无副作用查询' : 'Side-effect free queries'}
              />
              <MetricTile
                label={isZh ? '写入能力' : 'Write ops'}
                value={capabilitySummary.writeCount}
                hint={isZh ? '可能改动系统状态' : 'May change system state'}
              />
              <MetricTile
                label={isZh ? '确认动作' : 'Confirmations'}
                value={capabilitySummary.confirmationCount}
                hint={getLocalizedConfirmationPolicy(assistant.default_confirmation_policy, isZh)}
              />
              <MetricTile
                label={isZh ? '历史窗口' : 'History window'}
                value={assistant.max_history_messages || '--'}
                hint={assistant.max_auto_read_steps
                  ? `${assistant.max_auto_read_steps} ${isZh ? '次自动读取' : 'auto reads'}`
                  : (isZh ? '按配置回放' : 'Config controlled')}
              />
            </div>
          </div>

          {assistant.chat_enabled === false ? (
            <div className="px-6 pt-6 md:px-8">
              <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-50">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{isZh ? 'AI 暂不可用' : 'AI unavailable'}</AlertTitle>
                <AlertDescription>
                  {isZh
                    ? '服务器尚未配置可用的模型密钥。你仍可查看历史会话和能力目录，但无法发送新请求。'
                    : 'The server does not currently expose a live model key. You can still inspect history and capability metadata, but cannot send new prompts.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:px-8">
            <div className="min-w-0 space-y-5">
              <Panel
                title={isZh ? '会话队列' : 'Session queue'}
                description={isZh ? '切换上下文或直接开新线程。' : 'Switch context or open a fresh thread.'}
                action={(
                  <Button
                    size="sm"
                    disabled={!canCreateConversation}
                    onClick={handleStartConversation}
                    className="rounded-full bg-white text-slate-950 hover:bg-slate-100"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {isZh ? '新会话' : 'New'}
                  </Button>
                )}
                bodyClassName="p-0"
              >
                <div className={`border-b px-4 py-4 ${PANEL_DIVIDER_CLASS}`}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      value={conversationSearch}
                      onChange={(event) => setConversationSearch(event.target.value)}
                      placeholder={isZh ? '搜索标题、摘要、模型或会话 ID' : 'Search title, preview, model, or session id'}
                      className={cn(INPUT_SHELL_CLASS, 'h-11 w-full rounded-[18px] pl-10 pr-4 text-sm')}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    <FilterPill active={conversationFilter === 'all'} onClick={() => setConversationFilter('all')}>
                      {isZh ? '全部' : 'All'}
                    </FilterPill>
                    <FilterPill active={conversationFilter === 'pending'} onClick={() => setConversationFilter('pending')}>
                      {isZh ? '待确认' : 'Pending'}
                    </FilterPill>
                    <FilterPill active={conversationFilter === 'active'} onClick={() => setConversationFilter('active')}>
                      {isZh ? '进行中' : 'Active'}
                    </FilterPill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MetricTile label={isZh ? '会话' : 'Sessions'} value={conversationItems.length} />
                    <MetricTile label="LLM" value={conversationItems.reduce((sum, item) => sum + Number(item?.llm_calls || 0), 0)} />
                    <MetricTile label={isZh ? '待确认' : 'Pending'} value={conversationItems.reduce((sum, item) => sum + Number(item?.pending_action_count || 0), 0)} />
                  </div>
                </div>
                <ScrollArea className={cn('h-[28rem]', PAGE_SCROLLBAR_CLASS)}>
                  <div className="space-y-3 p-4">
                    {isCreatingConversation ? (
                      <div className="rounded-[22px] border border-emerald-300 bg-emerald-50 px-4 py-4 dark:border-emerald-400/25 dark:bg-emerald-400/[0.12]">
                        <div className={cn(`text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>{isZh ? '当前为新会话草稿' : 'Drafting a new session'}</div>
                        <div className={cn(`mt-1 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>
                          {isZh ? '输入第一条命令后会自动建立线程。' : 'The first prompt will create the thread automatically.'}
                        </div>
                      </div>
                    ) : null}

                    {filteredConversationItems.map((item) => (
                      <ConversationRow
                        key={item.conversation_id}
                        item={item}
                        active={!isCreatingConversation && selectedConversationId === item.conversation_id}
                        locale={locale}
                        isZh={isZh}
                        onSelect={handleSelectConversation}
                      />
                    ))}

                    {filteredConversationItems.length === 0 && !conversationsQuery.isLoading && !workspaceQuery.isLoading ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-8 text-center text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {conversationItems.length === 0
                          ? (isZh ? '还没有会话记录。直接开一个新的。' : 'No sessions yet. Start a new one.')
                          : (isZh ? '没有符合当前筛选条件的会话。' : 'No sessions match the current filters.')}
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </Panel>
            </div>

            <div className="min-w-0 space-y-5">
              <Panel
                title={selectedConversationTitle}
                description={isCreatingConversation
                  ? (isZh ? '新线程将在你发送第一条消息时建立。' : 'A new thread will be created when you send the first prompt.')
                  : (currentConversationIdLabel
                    ? (isZh ? `会话 ID：${currentConversationIdLabel}` : `Session ID: ${currentConversationIdLabel}`)
                    : (isZh ? '会话 ID：--' : 'Session ID: --'))}
                titleClassName="text-[1.9rem] leading-[1.14] md:text-[2.35rem]"
                action={(
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {currentSummary.message_count ? (
                      <StatusChip>
                        <MessageSquare className="h-3.5 w-3.5" />
                        {currentSummary.message_count} {isZh ? '条消息' : 'messages'}
                      </StatusChip>
                    ) : null}
                    {currentSummary.llm_calls ? (
                      <StatusChip>
                        <Cpu className="h-3.5 w-3.5" />
                        {currentSummary.llm_calls} LLM
                      </StatusChip>
                    ) : null}
                    {currentSummary.total_tokens ? (
                      <StatusChip>
                        {formatCompactNumber(currentSummary.total_tokens)} {isZh ? '令牌' : 'tok'}
                      </StatusChip>
                    ) : null}
                    {currentSummary.last_activity_at ? (
                      <StatusChip>
                        <Clock3 className="h-3.5 w-3.5" />
                        {lastActivityLabel}
                      </StatusChip>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className={OUTLINE_BUTTON_CLASS}
                      onClick={handleNavigateAudit}
                    >
                      {isZh ? '审计' : 'Audit'}
                    </Button>
                  </div>
                )}
                stackAction
                bodyClassName="p-0"
                className="overflow-hidden"
              >
                <div className="relative flex min-h-[44rem] flex-col">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.06),transparent_34%)] dark:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_30%)]" />

                  <div className="min-h-0 flex-1">
                    {conversationDetailQuery.isLoading && !isCreatingConversation ? (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-slate-500" />
                      </div>
                    ) : conversationTimeline.length === 0 && !streamState.optimisticMessage && streamState.items.length === 0 ? (
                      <EmptyConversationState
                        isZh={isZh}
                        starterPrompts={starterPrompts}
                        onUsePrompt={handleUsePrompt}
                        onNavigateAudit={handleNavigateAudit}
                      />
                    ) : (
                      <ScrollArea className={cn('h-[34rem]', PAGE_SCROLLBAR_CLASS)}>
                        <div className="space-y-6 p-5 md:p-6">
                          <AnimatePresence initial={false}>
                            {conversationTimeline.map((item) => (
                              item?.kind === 'message' ? (
                                <MessageBubble
                                  key={`message-${item.id}`}
                                  message={item}
                                  locale={locale}
                                  isZh={isZh}
                                  t={t}
                                  disabled={disableProposalActions}
                                  onNavigateSuggestion={handleNavigateSuggestion}
                                  onConfirmProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'confirm',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'reject',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                />
                              ) : item?.kind === 'agent_step' ? (
                                <AgentStepTimelineCard
                                  key={item.id}
                                  item={item}
                                  locale={locale}
                                  isZh={isZh}
                                  t={t}
                                  disabled={disableProposalActions}
                                  onRollback={handleCreateRollback}
                                />
                              ) : (
                                <EventTimelineRow
                                  key={`event-${item.id}`}
                                  item={item}
                                  locale={locale}
                                  isZh={isZh}
                                  t={t}
                                  disabled={disableProposalActions}
                                  onConfirmProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'confirm',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                  onRejectProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                    proposalId,
                                    outcome: 'reject',
                                    conversationId: normalizedSelectedConversationId,
                                  })}
                                  onRollback={handleCreateRollback}
                                />
                              )
                            ))}
                            {shouldRenderOptimisticMessage ? (
                              <MessageBubble
                                key={streamState.optimisticMessage.id}
                                message={streamState.optimisticMessage}
                                locale={locale}
                                isZh={isZh}
                                t={t}
                                disabled={disableProposalActions}
                                onNavigateSuggestion={handleNavigateSuggestion}
                                onConfirmProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                  proposalId,
                                  outcome: 'confirm',
                                  conversationId: normalizedSelectedConversationId,
                                })}
                                onRejectProposal={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                  proposalId,
                                  outcome: 'reject',
                                  conversationId: normalizedSelectedConversationId,
                                })}
                              />
                            ) : null}
                            {streamState.items.map((item) => (
                              <AgentStreamEventCard
                                key={item.id}
                                item={item}
                                isZh={isZh}
                                t={t}
                                disabled={disableProposalActions}
                                onRollback={handleCreateRollback}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      </ScrollArea>
                    )}
                  </div>

                  <div className={`border-t bg-slate-50/80 px-5 py-5 dark:bg-black/20 ${PANEL_DIVIDER_CLASS}`}>
                    <div
                      className="mb-3 grid gap-2 md:grid-cols-3"
                      role="radiogroup"
                      aria-label={isZh ? '自治模式' : 'Autonomy mode'}
                    >
                      {autonomyOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={autonomyMode === option.id}
                          tabIndex={autonomyMode === option.id ? 0 : -1}
                          onClick={() => setAutonomyMode(option.id)}
                          onKeyDown={(event) => {
                            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
                            event.preventDefault();
                            const currentIndex = autonomyOptions.findIndex((item) => item.id === autonomyMode);
                            const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
                            const nextIndex = (currentIndex + direction + autonomyOptions.length) % autonomyOptions.length;
                            setAutonomyMode(autonomyOptions[nextIndex].id);
                          }}
                          className={cn(
                            'rounded-[18px] border px-3 py-3 text-left transition',
                            autonomyMode === option.id
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                          )}
                        >
                          <div className="text-xs font-semibold">{option.label}</div>
                          <div className="mt-1 text-[11px] leading-4 opacity-70">{option.description}</div>
                        </button>
                      ))}
                    </div>
                    <div className={cn(`mb-3 flex flex-wrap items-center justify-between gap-3 text-xs ${TEXT_SECONDARY_CLASS}`)}>
                      <span>
                        {isZh
                          ? '写清目标、对象、时间范围；Ctrl/Cmd + Enter 发送。'
                          : 'State the objective, subject, and time scope; press Ctrl/Cmd + Enter to send.'}
                      </span>
                      {busyLabel ? (
                        <span className={cn(`inline-flex items-center gap-2 ${TEXT_SECONDARY_CLASS}`)}>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {busyLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                      <Textarea
                        ref={composerRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={assistant.chat_enabled === false
                          ? (isZh ? '模型未启用，暂不可发送。' : 'Model access is disabled.')
                          : (isZh ? '例如：汇总最近 7 天待处理事项，并按优先级给出建议。' : 'Example: Summarize unresolved items from the last 7 days and rank the next actions.')}
                        disabled={assistant.chat_enabled === false}
                        className={cn(INPUT_SHELL_CLASS, 'min-h-[146px] rounded-[28px] px-5 py-4 text-sm')}
                      />
                      <Button
                        className="h-auto rounded-[28px] bg-emerald-500 text-base text-black hover:bg-emerald-400"
                        disabled={!canSend}
                        onClick={handleSend}
                      >
                        {sendMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isZh ? '发送任务' : 'Send task'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>

              <div className={cn(PANEL_SHELL_CLASS, 'p-4 md:p-5')}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="min-w-0">
                      <div className={cn(`text-sm font-semibold ${TEXT_PRIMARY_CLASS}`)}>
                        {isZh ? '二级工作区' : 'Secondary workspace'}
                      </div>
                      <div className={cn(`mt-1 text-xs leading-5 ${TEXT_SECONDARY_CLASS}`)}>
                        {currentSection?.description || (isZh ? '把补充信息收进切换面板，主会话只保留真正的工作流。' : 'Keep supporting controls behind a switcher so the main workspace stays readable.')}
                      </div>
                    </div>
                    <div className={cn(`text-xs ${TEXT_TERTIARY_CLASS}`)}>
                      {isZh ? '不再把检查器、工具和导航摊成第三列。' : 'Inspector, tools, and routes no longer fight as a third column.'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {secondarySections.map((section) => (
                      <WorkspaceSectionButton
                        key={section.id}
                        active={workspaceSection === section.id}
                        icon={section.icon}
                        label={section.label}
                        count={section.count}
                        onClick={() => setWorkspaceSection(section.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <MotionDiv
                  key={workspaceSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  {workspaceSection === 'actions' ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                      <Panel
                        title={isZh ? '待确认动作' : 'Pending actions'}
                        description={isZh ? '所有写入类提案都先落在这里。' : 'Write proposals surface here before execution.'}
                      >
                        <div className="space-y-3">
                          {pendingActions.length > 0 ? pendingActions.map((action) => (
                            <PendingActionTile
                              key={action.proposal_id}
                              action={action}
                              disabled={disableProposalActions}
                              isZh={isZh}
                              onConfirm={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                proposalId,
                                outcome: 'confirm',
                                conversationId: normalizedSelectedConversationId,
                              })}
                              onReject={(proposalId) => normalizedSelectedConversationId && decisionMutation.mutate({
                                proposalId,
                                outcome: 'reject',
                                conversationId: normalizedSelectedConversationId,
                              })}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {isZh ? '当前会话没有挂起动作。' : 'No pending actions in this session.'}
                            </div>
                          )}
                        </div>
                      </Panel>

                      <Panel
                        title={isZh ? '下一步衔接' : 'Next-step handoff'}
                        description={isZh ? '把刚查出的结果直接改写成下一步动作，避免重新描述上下文。' : 'Turn the current read result into the next action without restating context.'}
                      >
                        <div className="space-y-3">
                          {resultFollowUps.length > 0 ? resultFollowUps.map((item) => (
                            <QuickLaunchButton
                              key={item.id}
                              label={item.label}
                              description={item.description}
                              onClick={() => handleUsePrompt(item.prompt)}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {isZh ? '当前结果还没有可直接续接的动作建议。' : 'The current result does not expose follow-up actions yet.'}
                            </div>
                          )}
                        </div>
                      </Panel>
                    </div>
                  ) : null}

                  {workspaceSection === 'shortcuts' ? (
                    <div className="grid gap-5 xl:grid-cols-2">
                      <Panel
                        title={isZh ? '快速切入' : 'Launchpad'}
                        description={isZh ? '直接跳到高频任务页，不必先问 AI。' : 'Jump to common admin surfaces without going through chat first.'}
                      >
                        <div className="space-y-3">
                          {localizedSpotlightRoutes.length > 0 ? localizedSpotlightRoutes.map((action) => (
                            <QuickLaunchButton
                              key={action.id}
                              label={action.label}
                              description={action.description}
                              onClick={() => handleRunQuickAction(action)}
                            />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {isZh ? '当前没有可展示的快捷入口。' : 'No quick actions available.'}
                            </div>
                          )}
                        </div>
                      </Panel>

                      <Panel
                        title={isZh ? '导航跳板' : 'Route bridge'}
                        description={isZh ? '直接跳转到其他后台页进行人工处理。' : 'Jump into another admin surface for manual follow-up.'}
                      >
                        <div className="space-y-3">
                          {localizedSideRoutes.map((target) => (
                            <QuickLaunchButton
                              key={target.id}
                              label={target.label}
                              description={target.description}
                              onClick={() => navigate(target.route)}
                            />
                          ))}
                        </div>
                      </Panel>
                    </div>
                  ) : null}

                  {workspaceSection === 'inspector' ? (
                    <Panel
                      title={isZh ? '当前会话检查器' : 'Current session inspector'}
                      description={isZh ? '模型回合、结果快照和操作密度都在这里。' : 'Model turns, result snapshots, and execution density live here.'}
                      action={(
                        <Button
                          size="sm"
                          variant="outline"
                          className={OUTLINE_BUTTON_CLASS}
                          onClick={() => setInspectorOpen((value) => !value)}
                        >
                          {inspectorOpen ? (isZh ? '收起' : 'Collapse') : (isZh ? '展开' : 'Expand')}
                        </Button>
                      )}
                    >
                      {inspectorOpen ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <MetricTile
                              label={isZh ? '消息' : 'Messages'}
                              value={currentSummary.message_count || 0}
                              hint={getConversationStatusLabel(currentSummary.status, isZh)}
                            />
                            <MetricTile
                              label="LLM"
                              value={currentSummary.llm_calls || 0}
                              hint={currentSummary.last_model || (isZh ? '暂无模型信息' : 'No model info')}
                            />
                            <MetricTile
                              label={isZh ? '令牌' : 'Tokens'}
                              value={formatCompactNumber(currentSummary.total_tokens || 0)}
                              hint={pendingActions.length > 0
                                ? `${pendingActions.length} ${isZh ? '个待确认动作' : 'pending actions'}`
                                : (isZh ? '无挂起动作' : 'No pending action')}
                            />
                          </div>

                          {latestAssistantResult ? (
                            <div className="mt-4">
                              <ResultSnapshot title={isZh ? '最新结果快照' : 'Latest result snapshot'} value={latestAssistantResult} isZh={isZh} />
                            </div>
                          ) : null}

                          <div className="mt-4">
                            <RunInspector runs={conversationRuns} currentRun={currentRun} isZh={isZh} locale={locale} />
                          </div>

                          <div className="mt-4 space-y-3">
                            {(llmCalls.length > 0 ? llmCalls.slice(-3).reverse() : []).map((item) => (
                              <LlmCallCard key={item.id} item={item} locale={locale} isZh={isZh} />
                            ))}
                            {llmCalls.length === 0 ? (
                              <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                                {isZh ? '这条会话还没有模型回合。' : 'No model turns recorded for this session yet.'}
                              </div>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-300/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-black/20">
                          <div className={cn(`text-sm font-medium ${TEXT_PRIMARY_CLASS}`)}>{inspectorSummary.title}</div>
                          <div className={cn(`mt-2 text-xs leading-6 ${TEXT_SECONDARY_CLASS}`)}>{inspectorSummary.detail}</div>
                        </div>
                      )}
                    </Panel>
                  ) : null}

                  {workspaceSection === 'capabilities' ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                      <Panel
                        title={isZh ? '能力边界' : 'Capability guardrails'}
                        description={isZh ? '当前工作台理解并可调用的管理动作。' : 'Management actions currently exposed to the workspace.'}
                      >
                        <div className="space-y-3">
                          {capabilityPreview.length > 0 ? capabilityPreview.map((action) => (
                            <CapabilityTile key={action.name} action={action} isZh={isZh} />
                          )) : (
                            <div className="rounded-[22px] border border-dashed border-slate-300/80 px-4 py-6 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400">
                              {isZh ? '没有可显示的能力目录。' : 'No capability catalog available.'}
                            </div>
                          )}
                        </div>
                      </Panel>

                      <Panel
                        title={isZh ? '任务模板' : 'Task templates'}
                        description={isZh ? '把常见管理动作改写成更容易触发工具调用的指令。' : 'Reuse operational prompts that are more likely to trigger the right tool path.'}
                      >
                        <div className="space-y-3">
                          {taskTemplates.slice(0, 5).map((item) => (
                            <PromptButton key={item.name} label={item.localizedLabel || item.label} prompt={item.prompt} onUse={handleUsePrompt} />
                          ))}
                        </div>
                      </Panel>
                    </div>
                  ) : null}
                </MotionDiv>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
