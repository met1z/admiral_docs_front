import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';
import type { DocumentType } from '@/lib/http';

type HeaderProps = {
  isOpen: boolean;
  onToggle: () => void;
  activeType: DocumentType | null;
};

function formatUserName(firstName: string | null, lastName: string | null, email: string) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || email;
}

export function Header({ isOpen, onToggle, activeType }: HeaderProps) {
  const { user } = useAuth();
  const { types, homeType } = useDocumentsMeta();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleCreate(type: DocumentType) {
    setMenuOpen(false);
    navigate(`/create/${type.code}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label={t('layout.openDrawer')}>
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        <div className="hidden text-sm text-slate-500 md:block">{t('app.name')}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <Button variant="secondary" className="hidden md:inline-flex" onClick={() => setMenuOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            {t('documents.create')}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('documents.create')}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {menuOpen ? (
            <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t('documents.chooseType')}
              </p>
              <div className="max-h-72 overflow-y-auto">
                {(types.length > 0 ? types : homeType ? [homeType] : []).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleCreate(type)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span className="truncate">{type.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden text-right md:block">
          <p className="text-sm font-medium text-slate-900">
            {user ? formatUserName(user.firstName, user.lastName, user.email) : ''}
          </p>
          <p className="text-xs text-slate-500">
            {user?.role === 'ADMIN' ? t('auth.inviteRoleAdmin') : t('auth.inviteRoleUser')}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-900">
          {user ? `${user.firstName?.[0] ?? user.email[0] ?? 'U'}${user.lastName?.[0] ?? ''}` : 'U'}
        </div>
      </div>
    </header>
  );
}
