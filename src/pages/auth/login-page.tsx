import { useState } from 'react';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/http';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (error) {
      setError(error instanceof ApiError ? error.message : t('auth.login.invalid'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,oklch(0.52_0.105_223.128/0.08),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f7f9fd_100%)] px-4 py-8">
      <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_90px_rgba(15,23,42,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
          {t('app.name')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {t('auth.login.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('auth.login.description')}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{t('auth.login.emailLabel')}</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('auth.login.emailPlaceholder')}
              required
              autoComplete="email"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{t('auth.login.passwordLabel')}</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.login.passwordPlaceholder')}
              required
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <p className="whitespace-pre-line rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? t('auth.login.loading') : t('auth.login.submit')}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <Link className="ml-auto hover:text-slate-900" to="/forgot-password">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>
      </section>
    </main>
  );
}
