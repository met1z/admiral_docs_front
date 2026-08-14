import { useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/http';

export function ResetPasswordPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (password.length < 8) {
      setError(t('auth.resetPassword.minLengthError'));
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await resetPassword({ token, password });
      navigate('/login', { replace: true });
    } catch (error) {
      setError(error instanceof ApiError ? error.message : t('auth.login.invalid'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{t('auth.resetPassword.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('auth.resetPassword.description')}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{t('auth.resetPassword.passwordLabel')}</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.resetPassword.passwordPlaceholder')}
              required
              minLength={8}
            />
          </label>

          {error ? (
            <p className="whitespace-pre-line rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={submitting || !token}>
            {submitting ? t('auth.resetPassword.loading') : t('auth.resetPassword.submit')}
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          <Link className="hover:text-slate-900" to="/login">
            {t('auth.login.title')}
          </Link>
        </div>
      </section>
    </main>
  );
}
