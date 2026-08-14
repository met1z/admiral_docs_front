import { useState } from 'react';

import { CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/http';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await forgotPassword({ email });
      setSubmittedEmail(email);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : t('auth.login.invalid'));
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedEmail) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-8">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/85 p-8 text-center shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            {t('auth.forgotPassword.successTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t('auth.forgotPassword.successDescription', { email: submittedEmail })}
          </p>
          <p className="mt-2 text-sm text-slate-500">{t('auth.forgotPassword.successNote')}</p>
          <div className="mt-8">
            <Button className="w-full" type="button" onClick={() => navigate('/login')}>
              {t('auth.forgotPassword.backToLogin')}
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
          {t('app.name')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {t('auth.forgotPassword.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('auth.forgotPassword.description')}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              {t('auth.forgotPassword.emailLabel')}
            </span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              required
              autoComplete="email"
            />
          </label>

          {error ? (
            <p className="whitespace-pre-line rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? t('auth.forgotPassword.loading') : t('auth.forgotPassword.submit')}
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          <Link className="hover:text-slate-900" to="/login">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </section>
    </main>
  );
}
