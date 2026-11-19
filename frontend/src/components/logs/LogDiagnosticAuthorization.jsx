import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { ClipboardCopy, KeyRound } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { logDiagnostics } from '../../lib/api/logDiagnostics';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/badge';

const namespace = 'admin.logDiagnostics.';
const types = ['system', 'error', 'audit', 'llm'];
const defaultTypes = types.filter((type) => type !== 'llm');
const sessionKey = 'log-diagnostic-sessions';

function localTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function CopyValue({ label, value }) {
  const { t } = useTranslation(['admin']);
  const [status, setStatus] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('copyError');
    }
  }

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Input aria-label={label} readOnly value={value} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t(namespace + 'copy')}>
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {status && <p role="status" className="text-xs text-muted-foreground">{t(namespace + status)}</p>}
    </div>
  );
}

CopyValue.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired };

function DiagnosticCreateForm({ initialTypes, from, to, settings, onCreated }) {
  const { t } = useTranslation(['admin']);
  const [selected, setSelected] = useState(() => {
    const available = defaultTypes.filter((type) => initialTypes.includes(type));
    return available.length ? available : defaultTypes;
  });
  const [name, setName] = useState('');
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [duration, setDuration] = useState(Math.min(30, settings.max_session_minutes));
  const [issueRest, setIssueRest] = useState(false);

  const create = useMutation(async () => {
    const data = {
      name,
      types: selected,
      expires_in_minutes: Number(duration),
      issue_rest_token: issueRest,
    };
    if (start) data.from = new Date(start).toISOString();
    if (end) data.to = new Date(end).toISOString();
    const result = await logDiagnostics.create(data);
    onCreated(result);
  });

  function toggle(type) {
    setSelected((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <h3 className="font-semibold">{t(namespace + 'create')}</h3>
      <label className="block space-y-1 text-sm">
        <span>{t(namespace + 'name')}</span>
        <Input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} placeholder={t(namespace + 'autoName')} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t(namespace + 'types')}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {types.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(type)} onChange={() => toggle(type)} />
              {t('admin.systemLogs.types.' + type)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(namespace + 'llmMetadata')}</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{t(namespace + 'from')}</span>
          <Input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t(namespace + 'to')}</span>
          <Input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t(namespace + 'windowHint')}</p>
      <label className="block space-y-1 text-sm">
        <span>{t(namespace + 'duration')}</span>
        <Input required type="number" min={1} max={settings.max_session_minutes} value={duration} onChange={(event) => setDuration(event.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={issueRest} onChange={(event) => setIssueRest(event.target.checked)} />
        {t(namespace + 'issueNow')}
      </label>
      {create.isError && <Alert variant="destructive"><AlertDescription>{t(namespace + 'createError')}</AlertDescription></Alert>}
      <Button type="submit" disabled={create.isLoading || !selected.length}>
        {t(namespace + 'create')}
      </Button>
    </form>
  );
}

DiagnosticCreateForm.propTypes = {
  initialTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  settings: PropTypes.shape({ max_session_minutes: PropTypes.number.isRequired }).isRequired,
  onCreated: PropTypes.func.isRequired,
};

function SessionDetails({ id, onIssued, onChange }) {
  const { t } = useTranslation(['admin']);
  const [auditBefore, setAuditBefore] = useState(null);
  const detail = useQuery([sessionKey, id], () => logDiagnostics.detail(id));
  const history = useQuery([sessionKey, id, 'history', auditBefore], () => logDiagnostics.history(id, auditBefore));
  const issue = useMutation(async () => {
    onIssued(await logDiagnostics.issue(id));
    onChange();
  });
  const revoke = useMutation((credentialId) => logDiagnostics.revoke(id, credentialId), { onSuccess: onChange });

  function confirmRevocation(credentialId) {
    if (window.confirm(t(namespace + (credentialId ? 'confirmCredential' : 'confirmSession')))) {
      revoke.mutate(credentialId);
    }
  }

  if (detail.isLoading) return <p role="status">{t(namespace + 'loading')}</p>;
  if (!detail.data) return <p role="alert">{t(namespace + 'loadError')}</p>;
  const session = detail.data;
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={session.name}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{session.name}</h3>
          <p className="text-sm text-muted-foreground">{t(namespace + 'creator', { id: session.created_by })}</p>
        </div>
        <Badge variant="outline">{t(namespace + 'states.' + session.status)}</Badge>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt>{t(namespace + 'from')}</dt><dd className="text-muted-foreground">{localTime(session.from)}</dd></div>
        <div><dt>{t(namespace + 'to')}</dt><dd className="text-muted-foreground">{localTime(session.to)}</dd></div>
        <div><dt>{t(namespace + 'expiresAt')}</dt><dd className="text-muted-foreground">{localTime(session.expires_at)}</dd></div>
        <div><dt>{t(namespace + 'usage')}</dt><dd className="text-muted-foreground">
          {t(namespace + 'usageValue', { calls: session.query_count, bytes: session.result_bytes })}
        </dd></div>
      </dl>
      <ul className="flex flex-wrap gap-1.5">
        {session.types.map((type) => <li key={type}><Badge variant="secondary">{t('admin.systemLogs.types.' + type)}</Badge></li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        {session.can_issue_rest && <Button type="button" size="sm" variant="outline" disabled={issue.isLoading} onClick={() => issue.mutate()}>
          {t(namespace + 'issueRest')}
        </Button>}
        {session.status === 'active' && <Button type="button" size="sm" variant="destructive" disabled={revoke.isLoading} onClick={() => confirmRevocation()}>
          {t(namespace + 'revoke')}
        </Button>}
      </div>
      {(issue.isError || revoke.isError) && (
        <Alert variant="destructive"><AlertDescription>{t(namespace + 'actionError')}</AlertDescription></Alert>
      )}
      <div className="space-y-2">
        <h4 className="font-medium">{t(namespace + 'credentials')}</h4>
        {!session.credentials.length && <p className="text-sm text-muted-foreground">{t(namespace + 'noCredentials')}</p>}
        {session.credentials.map((credential) => (
          <div key={credential.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
            <span>{credential.channel.toUpperCase()} #{credential.id} · {t(namespace + 'states.' + credential.status)}</span>
            {credential.status === 'active' && <Button type="button" size="sm" variant="outline" disabled={revoke.isLoading}
              onClick={() => confirmRevocation(credential.id)}>
              {t(namespace + 'revokeCredential')}
            </Button>}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">{t(namespace + 'audit')}</h4>
        {history.isLoading && <p role="status">{t(namespace + 'loading')}</p>}
        {history.isError && <p role="alert">{t(namespace + 'loadError')}</p>}
        {history.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{t(namespace + 'emptyAudit')}</p>}
        {history.data?.items.map((event) => (
          <div key={event.id} className="rounded border p-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span>{event.details?.tool || t(namespace + 'actions.' + event.action, { defaultValue: event.action })}</span>
              <span>{event.response_code} · {localTime(event.created_at)}</span>
            </div>
            {event.request_id && <div className="break-all font-mono text-xs text-muted-foreground">{event.request_id}</div>}
            {event.details?.reason && <div className="text-xs text-muted-foreground">{event.details.reason}</div>}
          </div>
        ))}
        <PageActions before={auditBefore} next={history.data?.next_before_id} onChange={setAuditBefore} />
      </div>
    </section>
  );
}

SessionDetails.propTypes = { id: PropTypes.number.isRequired, onIssued: PropTypes.func.isRequired, onChange: PropTypes.func.isRequired };

export function PageActions({ before, next, onChange }) {
  const { t } = useTranslation(['admin']);
  if (!before && !next) return null;
  return (
    <div className="flex gap-2">
      {before && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>{t(namespace + 'firstPage')}</Button>}
      {next && <Button type="button" variant="outline" size="sm" onClick={() => onChange(next)}>{t(namespace + 'nextPage')}</Button>}
    </div>
  );
}

PageActions.propTypes = { before: PropTypes.number, next: PropTypes.number, onChange: PropTypes.func.isRequired };

function AuthorizationPanel({ initialTypes, from, to, settings }) {
  const { t } = useTranslation(['admin']);
  const queryClient = useQueryClient();
  const [before, setBefore] = useState(null);
  const [id, setId] = useState(null);
  const [issued, setIssued] = useState(null);
  const sessions = useQuery([sessionKey, 'list', before], () => logDiagnostics.sessions({ before_id: before }));
  const refresh = () => queryClient.invalidateQueries([sessionKey]);

  function select(sessionId) {
    setIssued(null);
    setId(sessionId);
  }

  function created(result) {
    setBefore(null);
    setId(result.session.id);
    setIssued(result.issued || null);
    refresh();
  }

  return (
    <div className="space-y-4">
      <CopyValue label={t(namespace + 'mcpUrl')} value={settings.mcp_url} />
      <DiagnosticCreateForm initialTypes={initialTypes} from={from} to={to} settings={settings} onCreated={created} />
      {issued && <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t(namespace + 'tokenOnce')}</p>
        <CopyValue key={issued.credential_id} label={t(namespace + 'restToken')} value={issued.access_token} />
        <CopyValue label={t(namespace + 'restUrl')} value={settings.rest_url} />
        <p className="text-sm text-muted-foreground">{t(namespace + 'expiresAt')} {localTime(issued.expires_at)}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIssued(null)}>{t(namespace + 'dismissToken')}</Button>
      </div>}
      <section className="space-y-2">
        <h3 className="font-semibold">{t(namespace + 'sessions')}</h3>
        {sessions.isLoading && <p role="status">{t(namespace + 'loading')}</p>}
        {sessions.isError && <p role="alert">{t(namespace + 'loadError')}</p>}
        {sessions.data?.items.length === 0 && <p className="text-sm text-muted-foreground">{t(namespace + 'emptySessions')}</p>}
        {sessions.data?.items.map((session) => (
          <Button key={session.id} type="button" variant={id === session.id ? 'secondary' : 'outline'}
            className="flex h-auto w-full justify-between gap-2 whitespace-normal text-left" onClick={() => select(session.id)}>
            <span className="min-w-0 break-words">{session.name}</span>
            <Badge variant="outline">{t(namespace + 'states.' + session.status)}</Badge>
          </Button>
        ))}
        <PageActions before={before} next={sessions.data?.next_before_id} onChange={setBefore} />
      </section>
      {id !== null && <SessionDetails key={id} id={id} onIssued={setIssued} onChange={refresh} />}
    </div>
  );
}

AuthorizationPanel.propTypes = {
  initialTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  settings: PropTypes.shape({
    max_session_minutes: PropTypes.number.isRequired,
    mcp_url: PropTypes.string.isRequired,
    rest_url: PropTypes.string.isRequired,
  }).isRequired,
};

export default function LogDiagnosticAuthorization({ initialTypes, from, to }) {
  const { t } = useTranslation(['admin']);
  const [open, setOpen] = useState(false);
  const { data: settings } = useQuery('log-diagnostic-settings', logDiagnostics.settings, { retry: false });
  if (!settings?.enabled) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />{t(namespace + 'title')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t(namespace + 'title')}</DialogTitle>
            <DialogDescription>{t(namespace + 'description')}</DialogDescription>
          </DialogHeader>
          {open && <AuthorizationPanel initialTypes={initialTypes} from={from} to={to} settings={settings} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

LogDiagnosticAuthorization.propTypes = {
  initialTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
};
