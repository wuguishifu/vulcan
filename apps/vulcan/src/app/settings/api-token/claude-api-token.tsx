'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteApiToken, hasApiToken, setApiToken } from '@/modules/api-token';

export function ClaudeApiToken() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasApiToken()
      .then((value) => {
        if (!cancelled) setHasToken(value);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!token.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await setApiToken(token.trim());
      setToken('');
      setHasToken(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await deleteApiToken();
      setHasToken(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Claude API token</h2>
        <p className="text-sm text-muted-foreground">
          Used to call the Claude API. The token is stored in your system
          keychain and never leaves this device except to talk to Anthropic.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        {hasToken === null && !error ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {hasToken && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CheckIcon className="size-3.5" />
                  Token saved
                </span>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Delete Claude API token"
                  disabled={saving}
                  onClick={remove}
                >
                  <Trash2Icon />
                </Button>
              </div>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder={hasToken ? 'Replace token (sk-ant-…)' : 'sk-ant-…'}
                value={token}
                disabled={saving}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={saving || !token.trim()}
              >
                Save
              </Button>
            </form>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </section>
  );
}
