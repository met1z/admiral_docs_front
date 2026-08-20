import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

type HeaderProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function formatUserName(firstName: string | null, lastName: string | null, email: string) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || email;
}

export function Header({ isOpen, onToggle }: HeaderProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 text-slate-950 shadow-sm backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label={t('layout.openDrawer')}>
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        <div className="hidden text-sm font-medium text-slate-500 md:block">{t('app.name')}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium text-slate-950">
            {user ? formatUserName(user.firstName, user.lastName, user.email) : ''}
          </p>
          <p className="text-xs text-slate-500">
            {user?.role === 'ADMIN' ? t('auth.inviteRoleAdmin') : t('auth.inviteRoleUser')}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-900 shadow-sm">
          {user ? `${user.firstName?.[0] ?? user.email[0] ?? 'U'}${user.lastName?.[0] ?? ''}` : 'U'}
        </div>
      </div>
    </header>
  );
}
