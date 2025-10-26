
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useQuery } from 'react-query';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import { Input } from '../../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import {
  RefreshCw,
  Loader2,
  ListChecks,
  ShieldCheck,
  Shield,
  Layers,
  Code,
  Globe2,
  Download,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const UNTAGGED_TOKEN = '__untagged__';
const REMOTE_SPEC_FALLBACK =
  'https://raw.githubusercontent.com/carbon-track/carbontrack-rev/refs/heads/main/backend/openapi.json';

const HTTP_METHOD_STYLES = {
  GET: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  POST: 'border-sky-200 bg-sky-50 text-sky-700',
  PUT: 'border-amber-200 bg-amber-50 text-amber-700',
  PATCH: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
  OPTIONS: 'border-slate-200 bg-slate-50 text-slate-600',
  HEAD: 'border-slate-200 bg-slate-50 text-slate-600',
  DEFAULT: 'border-slate-200 bg-slate-100 text-slate-700',
};

function computeDefaultSpecUrl() {
  const explicit = import.meta.env?.VITE_OPENAPI_SPEC_URL;
  if (explicit) {
    return explicit;
  }
  return REMOTE_SPEC_FALLBACK;
}

const DEFAULT_SPEC_URL = computeDefaultSpecUrl();
async function fetchOpenApiSpec({ signal }) {
  const response = await fetch(DEFAULT_SPEC_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load OpenAPI spec (${response.status})`);
  }

  const spec = await response.json();
  if (!spec || typeof spec !== 'object' || !spec.paths) {
    throw new Error('OpenAPI document is missing path definitions');
  }

  return spec;
}

function buildOperations(spec) {
  if (!spec?.paths) {
    return [];
  }

  const globalSecurity = Array.isArray(spec.security) ? spec.security : [];
  const operations = [];

  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== 'object') return;

    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!HTTP_METHODS.includes(method.toLowerCase())) return;
      if (!operation || typeof operation !== 'object') return;

      const requestBody = operation.requestBody || null;
      const responses = operation.responses || {};
      const responseCodes = Object.keys(responses);
      const security = Array.isArray(operation.security) ? operation.security : globalSecurity;
      const requiresAuth = Array.isArray(security) && security.length > 0;

      const combinedParameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ];

      const securitySchemes = Array.isArray(security)
        ? [...new Set(security.flatMap((rule) => Object.keys(rule || {})))]
        : [];

      operations.push({
        id: `${method.toUpperCase()} ${path}`,
        path,
        method: method.toUpperCase(),
        summary: operation.summary || '',
        description: operation.description || '',
        tags: operation.tags && operation.tags.length ? operation.tags : [UNTAGGED_TOKEN],
        deprecated: Boolean(operation.deprecated),
        servers: operation.servers || spec.servers || [],
        requestBody,
        responses,
        responseCodes,
        parameters: combinedParameters,
        security,
        securitySchemes,
        requiresAuth,
        requestContentTypes: requestBody?.content ? Object.keys(requestBody.content) : [],
        responseContentTypes: Object.entries(responses).reduce((acc, [status, payload]) => {
          acc[status] = payload?.content ? Object.keys(payload.content) : [];
          return acc;
        }, {}),
      });
    });
  });

  return operations.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
}
function formatSchema(schema) {
  if (!schema) return '';
  if (schema.$ref) {
    return schema.$ref.split('/').pop();
  }
  if (schema.type === 'array') {
    const inner = formatSchema(schema.items);
    return inner ? `array<${inner}>` : 'array';
  }
  return schema.type || '';
}

function sortStatusCodes(codes) {
  return [...codes].sort((a, b) => {
    const numericA = /^\d+$/.test(a);
    const numericB = /^\d+$/.test(b);
    if (numericA && numericB) {
      return Number(a) - Number(b);
    }
    if (numericA) return -1;
    if (numericB) return 1;
    return a.localeCompare(b);
  });
}
export default function AdminDiagnosticsPage() {
  const { t, currentLanguage } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [securityFilter, setSecurityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const query = useQuery(['openapi-spec'], fetchOpenApiSpec, {
    staleTime: 5 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
  });

  const spec = query.data;
  const operations = useMemo(() => buildOperations(spec), [spec]);

  const availableMethods = useMemo(
    () => [...new Set(operations.map((op) => op.method))],
    [operations]
  );

  const availableTags = useMemo(() => {
    const tagSet = new Set();
    operations.forEach((op) => op.tags.forEach((tag) => tagSet.add(tag)));
    return [...tagSet];
  }, [operations]);

  const availableStatuses = useMemo(() => {
    const codes = new Set();
    operations.forEach((op) => op.responseCodes.forEach((code) => codes.add(code)));
    return sortStatusCodes([...codes]);
  }, [operations]);

  const filteredOperations = useMemo(() => {
    if (!operations.length) return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return operations.filter((operation) => {
      if (methodFilter !== 'all' && operation.method !== methodFilter) {
        return false;
      }
      if (tagFilter !== 'all' && !operation.tags.includes(tagFilter)) {
        return false;
      }
      if (securityFilter === 'secured' && !operation.requiresAuth) {
        return false;
      }
      if (securityFilter === 'public' && operation.requiresAuth) {
        return false;
      }
      if (statusFilter !== 'all' && !operation.responseCodes.includes(statusFilter)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [operation.path, operation.summary, operation.description]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(normalizedSearch));
    });
  }, [operations, methodFilter, tagFilter, securityFilter, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    if (!operations.length) {
      return {
        total: 0,
        secured: 0,
        publicCount: 0,
        tags: 0,
        methods: 0,
      };
    }
    const secured = operations.filter((op) => op.requiresAuth).length;
    const tagCount = new Set(operations.flatMap((op) => op.tags)).size;
    const methodCount = new Set(operations.map((op) => op.method)).size;
    return {
      total: operations.length,
      secured,
      publicCount: operations.length - secured,
      tags: tagCount,
      methods: methodCount,
    };
  }, [operations]);

  const translatedTag = (tag) => {
    if (tag !== UNTAGGED_TOKEN) return tag;
    return t('admin.diagnostics.labels.untagged', 'Untagged');
  };

  const securityLabels = useMemo(
    () => ({
      secured: t('admin.diagnostics.labels.authRequired', 'Requires auth'),
      public: t('admin.diagnostics.labels.publicEndpoint', 'Public endpoint'),
    }),
    [t]
  );

  const lastFetchedText = useMemo(() => {
    if (!query.dataUpdatedAt) return null;
    try {
      const formatter = new Intl.DateTimeFormat(currentLanguage || undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
      return formatter.format(new Date(query.dataUpdatedAt));
    } catch {
      return new Date(query.dataUpdatedAt).toLocaleString();
    }
  }, [currentLanguage, query.dataUpdatedAt]);

  const specVersion = spec?.info?.version;
  const specTitle = spec?.info?.title;
  const servers = Array.isArray(spec?.servers) ? spec.servers : [];

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/70 bg-white/90">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t('admin.diagnostics.title', 'API diagnostics')}</CardTitle>
            <CardDescription>
              {t(
                'admin.diagnostics.description',
                'Visualize the published OpenAPI contract, inspect endpoints, and verify request/response coverage.'
              )}
            </CardDescription>
            <dl className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {specTitle && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {t('admin.diagnostics.spec.title', 'API')}
                  </dt>
                  <dd>{specTitle}</dd>
                </div>
              )}
              {specVersion && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {t('admin.diagnostics.spec.version', 'Spec version')}
                  </dt>
                  <dd>{specVersion}</dd>
                </div>
              )}
              {lastFetchedText && (
                <div>
                  <dt className="font-semibold uppercase tracking-wide">
                    {t('admin.diagnostics.spec.fetchedAt', 'Fetched')}
                  </dt>
                  <dd>{lastFetchedText}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(DEFAULT_SPEC_URL, '_blank', 'noopener,noreferrer')}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('admin.diagnostics.spec.download', 'Download spec')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('admin.diagnostics.actions.refresh', 'Reload spec')}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={ListChecks}
          label={t('admin.diagnostics.stats.endpoints', 'Endpoints')}
          value={stats.total}
        />
        <StatCard
          icon={ShieldCheck}
          label={t('admin.diagnostics.stats.secured', 'Secured')}
          value={stats.secured}
        />
        <StatCard
          icon={Shield}
          label={t('admin.diagnostics.stats.public', 'Public')}
          value={stats.publicCount}
        />
        <StatCard
          icon={Layers}
          label={t('admin.diagnostics.stats.tags', 'Tags')}
          value={stats.tags}
        />
        <StatCard
          icon={Code}
          label={t('admin.diagnostics.stats.methods', 'HTTP methods')}
          value={stats.methods}
        />
      </div>

      <Card className="border-slate-200/70 bg-white/90">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('admin.diagnostics.filters.title', 'Filters')}
          </CardTitle>
          <CardDescription>
            {t(
              'admin.diagnostics.filters.description',
              'Search and narrow down endpoints by method, tag, security requirements, or response codes.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              {t('admin.diagnostics.filters.search', 'Search')}
            </label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t(
                  'admin.diagnostics.filters.searchPlaceholder',
                  'Search path, summary, or description'
                )}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterSelect
              label={t('admin.diagnostics.filters.method', 'HTTP method')}
              value={methodFilter}
              onValueChange={setMethodFilter}
              placeholder={t('admin.diagnostics.filters.methodAll', 'All methods')}
              options={availableMethods.map((method) => ({
                label: method,
                value: method,
              }))}
            />
            <FilterSelect
              label={t('admin.diagnostics.filters.tag', 'Tag')}
              value={tagFilter}
              onValueChange={setTagFilter}
              placeholder={t('admin.diagnostics.filters.tagAll', 'All tags')}
              options={availableTags.map((tag) => ({
                label: translatedTag(tag),
                value: tag,
              }))}
            />
            <FilterSelect
              label={t('admin.diagnostics.filters.security', 'Security')}
              value={securityFilter}
              onValueChange={setSecurityFilter}
              placeholder={t('admin.diagnostics.filters.securityAll', 'All endpoints')}
              options={[
                {
                  value: 'secured',
                  label: t('admin.diagnostics.filters.securitySecured', 'Requires auth'),
                },
                {
                  value: 'public',
                  label: t('admin.diagnostics.filters.securityPublic', 'Public'),
                },
              ]}
            />
            <FilterSelect
              label={t('admin.diagnostics.filters.status', 'Response code')}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder={t('admin.diagnostics.filters.statusAll', 'All status codes')}
              options={availableStatuses.map((code) => ({
                label: code,
                value: code,
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>{t('admin.diagnostics.status.errorTitle', 'Unable to load API spec')}</AlertTitle>
          <AlertDescription>
            {query.error?.message ||
              t(
                'admin.diagnostics.status.errorDescription',
                'The OpenAPI document could not be loaded. Check the configured URL or try again.'
              )}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200/70 bg-white/90">
        <CardHeader className="flex flex-col gap-2 border-b border-slate-100/80 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {t('admin.diagnostics.results.title', 'Endpoint catalog')}
              </CardTitle>
              <CardDescription>
                {t('admin.diagnostics.results.count', {
                  defaultValue: '{{count}} endpoints match the current filters',
                  count: filteredOperations.length,
                })}
              </CardDescription>
            </div>
            {servers.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe2 className="h-4 w-4" />
                <span>
                  {t('admin.diagnostics.spec.servers', 'Servers')}: {servers.length}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('admin.diagnostics.status.loading', 'Loading OpenAPI specification...')}
            </div>
          ) : filteredOperations.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              {t('admin.diagnostics.status.empty', 'No endpoints match the selected filters.')}
            </div>
          ) : (
            <Accordion type="single" collapsible>
              {filteredOperations.map((operation) => (
                <AccordionItem key={operation.id} value={operation.id}>
                  <AccordionTrigger className="px-4">
                    <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <MethodBadge method={operation.method} />
                          <p className="font-mono text-sm text-slate-900">{operation.path}</p>
                          {operation.deprecated && (
                            <Badge
                              variant="destructive"
                              className="border-rose-200 bg-rose-50 text-xs uppercase tracking-wide text-rose-700"
                            >
                              {t('admin.diagnostics.labels.deprecated', 'Deprecated')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {operation.summary ||
                            operation.description ||
                            t('admin.diagnostics.labels.noSummary', 'No summary provided')}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <SecurityBadge secured={operation.requiresAuth} labels={securityLabels} />
                        <div className="flex flex-wrap gap-1">
                          {operation.tags.slice(0, 3).map((tag) => (
                            <Badge key={`${operation.id}-${tag}`} variant="outline">
                              {translatedTag(tag)}
                            </Badge>
                          ))}
                          {operation.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{operation.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-slate-50/60 px-4">
                    <div className="space-y-6 rounded-lg border border-slate-200/80 bg-white p-6">
                      {operation.description && (
                        <p className="text-sm text-slate-600">{operation.description}</p>
                      )}

                      <div className="grid gap-6 md:grid-cols-2">
                        <InfoBlock
                          title={t('admin.diagnostics.labels.tags', 'Tags')}
                          value={
                            <div className="flex flex-wrap gap-2">
                              {operation.tags.map((tag) => (
                                <Badge key={`${operation.id}-${tag}-detail`} variant="secondary">
                                  {translatedTag(tag)}
                                </Badge>
                              ))}
                            </div>
                          }
                        />
                        <InfoBlock
                          title={t('admin.diagnostics.labels.security', 'Security')}
                          value={
                            operation.requiresAuth ? (
                              <div className="space-y-1 text-sm text-slate-700">
                                <p>{securityLabels.secured}</p>
                                {operation.securitySchemes.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {operation.securitySchemes.join(', ')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">{securityLabels.public}</p>
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <Section title={t('admin.diagnostics.labels.parameters', 'Parameters')}>
                          {operation.parameters.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t('admin.diagnostics.labels.noParameters', 'No parameters documented')}
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">
                                      {t('admin.diagnostics.table.name', 'Name')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {t('admin.diagnostics.table.in', 'In')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {t('admin.diagnostics.table.required', 'Required')}
                                    </th>
                                    <th className="px-3 py-2 font-semibold">
                                      {t('admin.diagnostics.table.type', 'Type')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {operation.parameters.map((parameter, index) => (
                                    <tr key={`${operation.id}-${parameter.name || index}`}>
                                      <td className="border-t px-3 py-2 font-mono text-xs">
                                        {parameter.name || '—'}
                                      </td>
                                      <td className="border-t px-3 py-2 text-xs uppercase text-slate-500">
                                        {parameter.in || '—'}
                                      </td>
                                      <td className="border-t px-3 py-2 text-xs">
                                        {parameter.required
                                          ? t('admin.diagnostics.labels.yes', 'Yes')
                                          : t('admin.diagnostics.labels.no', 'No')}
                                      </td>
                                      <td className="border-t px-3 py-2 text-xs">
                                        {formatSchema(parameter.schema) || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </Section>

                        <Section title={t('admin.diagnostics.labels.requestBody', 'Request body')}>
                          {operation.requestBody ? (
                            <div className="space-y-2 text-sm">
                              <p className="text-slate-600">
                                {operation.requestBody.description ||
                                  t('admin.diagnostics.labels.requestBodyDescription', 'Request payload')}
                              </p>
                              {operation.requestContentTypes.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {operation.requestContentTypes.map((type) => (
                                    <Badge key={`${operation.id}-${type}`} variant="outline">
                                      {type}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {t('admin.diagnostics.labels.noRequestBody', 'No request body')}
                            </p>
                          )}
                        </Section>
                      </div>

                      <Section title={t('admin.diagnostics.labels.responses', 'Responses')}>
                        {operation.responseCodes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t('admin.diagnostics.labels.noResponses', 'No responses documented')}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {sortStatusCodes(operation.responseCodes).map((code) => {
                              const response = operation.responses[code];
                              return (
                                <div
                                  key={`${operation.id}-${code}`}
                                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-3">
                                    <Badge
                                      variant="outline"
                                      className="border-slate-300 bg-white font-mono text-xs"
                                    >
                                      {code.toUpperCase()}
                                    </Badge>
                                    <p className="text-sm font-medium text-slate-800">
                                      {response?.description ||
                                        t(
                                          'admin.diagnostics.labels.noResponseDescription',
                                          'No description provided'
                                        )}
                                    </p>
                                  </div>
                                  {operation.responseContentTypes[code]?.length > 0 && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {t('admin.diagnostics.labels.responseContent', 'Content types')}:{' '}
                                      {operation.responseContentTypes[code].join(', ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="border-slate-200/70 bg-white/90">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-slate-100 p-2 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onValueChange, placeholder, options = [] }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <Select value={value} onValueChange={(val) => onValueChange(val)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MethodBadge({ method }) {
  const style =
    HTTP_METHOD_STYLES[method] || HTTP_METHOD_STYLES[method.toUpperCase()] || HTTP_METHOD_STYLES.DEFAULT;
  return (
    <Badge variant="outline" className={cn('font-mono text-xs uppercase', style)}>
      {method}
    </Badge>
  );
}

function SecurityBadge({ secured, labels }) {
  return secured ? (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-xs font-medium uppercase tracking-wide text-amber-700"
    >
      {labels.secured}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-xs font-medium uppercase tracking-wide text-emerald-700"
    >
      {labels.public}
    </Badge>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {typeof value === 'string' || typeof value === 'number' ? (
        <p className="text-sm text-slate-800">{value}</p>
      ) : (
        value
      )}
    </div>
  );
}
