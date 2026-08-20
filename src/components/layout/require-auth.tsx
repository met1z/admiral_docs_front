import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/auth-context';
import { useTranslation } from 'react-i18next';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          {t('auth.login.loading')}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
