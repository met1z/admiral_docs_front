import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/auth-context';

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const { t } = useTranslation();

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          {t('auth.login.loading')}
        </div>
      </div>
    );
  }

  return children;
}
