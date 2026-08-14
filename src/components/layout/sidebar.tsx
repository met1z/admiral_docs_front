import { useMemo, useState } from 'react';

import { Loader2, LogOut, MailPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/ui/toast';
import type { DocumentType } from '@/lib/http';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  types: DocumentType[];
  activeTypeCode: string | null;
  homeTypeCode: string | null;
  onSelectType: (typeCode: string) => void;
};

export function Sidebar({
  isOpen,
  onClose,
  types,
  activeTypeCode,
  homeTypeCode,
  onSelectType,
}: SidebarProps) {
  const { user, logout, inviteUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'USER'>('USER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const activeTypeName = useMemo(() => {
    return types.find((type) => type.code === activeTypeCode)?.name ?? t('layout.noTypes');
  }, [activeTypeCode, t, types]);

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setInviteLoading(true);

    try {
      await inviteUser({ email: inviteEmail, role: inviteRole });
      showToast({
        title: t('actions.done'),
        description: t('auth.inviteSuccess'),
        variant: 'success',
      });
      setInviteEmail('');
      setInviteRole('USER');
      setInviteOpen(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : t('auth.inviteErrorTitle'));
      showToast({
        title: t('auth.inviteErrorTitle'),
        ...(error instanceof Error ? { description: error.message } : {}),
        variant: 'error',
      });
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white/95 backdrop-blur',
          'transform-gpu transition-transform duration-300 ease-out will-change-transform',
          isOpen ? 'translate-x-0 shadow-[12px_0_48px_rgba(15,23,42,0.12)]' : '-translate-x-full shadow-none',
        ].join(' ')}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              {t('app.name')}
            </p>
          </div>
          <Button
            className="md:hidden"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('layout.closeDrawer')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t('layout.documentsTypes')}
            </p>
            <div className="space-y-2">
              {types.length > 0 ? (
                types.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => onSelectType(type.code)}
                    className={[
                      'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      activeTypeCode === type.code
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="truncate">{type.name}</span>
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">
                  {t('layout.noTypes')}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t('layout.currentType')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{activeTypeName}</p>
          </div>
        </div>

        <div className="border-t border-slate-200 p-4">
          {isAdmin ? (
            <Button
              className="mb-3 w-full justify-start"
              variant="secondary"
              onClick={() => setInviteOpen(true)}
            >
              <MailPlus className="h-4 w-4" />
              {t('auth.invite')}
            </Button>
          ) : null}
          <Button className="w-full justify-start" variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </Button>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          aria-label={t('layout.closeDrawer')}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/30 opacity-100 backdrop-blur-[1px] transition-opacity duration-300 md:hidden"
        />
      ) : null}

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 opacity-100 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-300 ease-out animate-[dialog-in_240ms_ease-out]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{t('auth.inviteTitle')}</h2>
                <p className="mt-1 text-sm text-slate-600">{t('auth.inviteDescription')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setInviteOpen(false);
                  setInviteError(null);
                }}
                aria-label={t('actions.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleInviteSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{t('auth.inviteEmailLabel')}</span>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder={t('auth.inviteEmailPlaceholder')}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">{t('auth.inviteRoleLabel')}</span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('USER')}
                    aria-pressed={inviteRole === 'USER'}
                    className={[
                      'rounded-xl px-4 py-3 text-left transition-all duration-200',
                      'border',
                      inviteRole === 'USER'
                        ? 'border-cyan-300 bg-white shadow-sm ring-1 ring-cyan-200'
                        : 'border-transparent bg-transparent hover:bg-white/70 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-semibold text-slate-900">
                      {t('auth.inviteRoleUser')}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {t('auth.inviteRoleUserDescription')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole('ADMIN')}
                    aria-pressed={inviteRole === 'ADMIN'}
                    className={[
                      'rounded-xl px-4 py-3 text-left transition-all duration-200',
                      'border',
                      inviteRole === 'ADMIN'
                        ? 'border-cyan-300 bg-white shadow-sm ring-1 ring-cyan-200'
                        : 'border-transparent bg-transparent hover:bg-white/70 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-semibold text-slate-900">
                      {t('auth.inviteRoleAdmin')}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {t('auth.inviteRoleAdminDescription')}
                    </span>
                  </button>
                </div>
              </label>

              {inviteError ? (
                <p className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-800">
                  {inviteError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={inviteLoading}
                  onClick={() => {
                    setInviteOpen(false);
                    setInviteError(null);
                  }}
                >
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('auth.inviteLoading')}
                    </>
                  ) : (
                    t('auth.inviteSubmit')
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
