import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { logDiagnostics } from '../../lib/api/logDiagnostics';
import { PageActions } from '../../components/logs/LogDiagnosticAuthorization';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Alert, AlertDescription } from '../../components/ui/Alert';

const ns = 'admin.logDiagnostics.';

export default function LogDiagnosticConsent() {
  const { t } = useTranslation(['admin']);
  const { id } = useParams();
  const [before, setBefore] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const request = useQuery(['log-diagnostic-consent', id], () => logDiagnostics.consent(id), { retry: false });
  const sessions = useQuery(['log-diagnostic-eligible', before],
    () => logDiagnostics.sessions({ eligible: 1, before_id: before }), { enabled: Boolean(request.data) });
  const selected = sessions.data?.items.find((session) => session.id === selectedId);
  const decide = useMutation(async (approve) => {
    const result = await logDiagnostics.decide(id, { approve, ...(approve ? { session_id: selected.id } : {}) });
    const resource = new URL(request.data.resource);
    const redirect = new URL(result.continue_url);
    const path = resource.pathname.replace(/\/mcp$/, '/oauth/consent');
    if (redirect.origin !== resource.origin || redirect.pathname !== path || redirect.search || !/^#ticket=[A-Za-z0-9_-]{43}$/.test(redirect.hash)) {
      throw new Error('Unexpected OAuth continuation URL.');
    }
    window.location.assign(redirect.href);
  });

  function page(value) {
    setSelectedId(null);
    setBefore(value);
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{t(ns + 'consentTitle')}</CardTitle>
        {request.data && <CardDescription>
          {t(ns + 'consentDescription', { client: request.data.client_name })}
        </CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {(request.isLoading || sessions.isLoading) && <p role="status">{t(ns + 'loading')}</p>}
        {(request.isError || sessions.isError) && <Alert variant="destructive">
          <AlertDescription>{t(ns + 'consentError')}</AlertDescription>
        </Alert>}
        {request.data && <>
          <p className="break-all font-mono text-xs text-muted-foreground">{request.data.resource}</p>
          <p className="text-sm">{t(ns + 'chooseSession')}</p>
          {sessions.data?.items.length === 0 && <p className="text-sm">
            {t(ns + 'noEligible')}{' '}
            <Link to="/admin/system-logs" target="_blank" rel="noopener noreferrer" className="underline">
              {t(ns + 'openLogs')}
            </Link>
          </p>}
          <div className="space-y-2">
            {sessions.data?.items.map((session) => (
              <label key={session.id} className="flex gap-3 rounded-lg border p-3 text-sm">
                <input type="radio" name="diagnostic-session" checked={selectedId === session.id} onChange={() => setSelectedId(session.id)} />
                <span className="space-y-1">
                  <span className="block font-medium">{session.name}</span>
                  <span className="block text-muted-foreground">
                    {session.types.map((type) => t('admin.systemLogs.types.' + type)).join(' · ')}
                  </span>
                  <span className="block text-muted-foreground">
                    {new Date(session.from).toLocaleString()} – {new Date(session.to).toLocaleString()}
                  </span>
                  <span className="block text-muted-foreground">
                    {t(ns + 'expiresAt')} {new Date(session.expires_at).toLocaleString()}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <PageActions before={before} next={sessions.data?.next_before_id} onChange={page} />
          {decide.isError && <Alert variant="destructive"><AlertDescription>{t(ns + 'consentError')}</AlertDescription></Alert>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!selected || decide.isLoading} onClick={() => decide.mutate(true)}>
              {t(ns + 'approve')}
            </Button>
            <Button type="button" variant="outline" disabled={decide.isLoading} onClick={() => decide.mutate(false)}>
              {t(ns + 'deny')}
            </Button>
          </div>
        </>}
      </CardContent>
    </Card>
  );
}
