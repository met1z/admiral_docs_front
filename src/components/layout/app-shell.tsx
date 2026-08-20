import { useEffect, useMemo, useState } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';

export function AppShell() {
  const { types, isLoading } = useDocumentsMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(() => window.innerWidth >= 768);

  const activeTypeCode = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith('/create/')) {
      return path.split('/')[2] ?? null;
    }

    const segment = path.split('/')[1];

    if (!segment || segment === 'document') {
      return null;
    }

    return segment;
  }, [location.pathname]);

  const isActionRequiredActive = location.pathname === '/' || location.pathname.startsWith('/document/');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setDrawerOpen(true);
      } else {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Завантажуємо типи документів...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f7f9fd_100%)]">
      <Sidebar
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        types={types}
        activeTypeCode={activeTypeCode}
        isActionRequiredActive={isActionRequiredActive}
        onOpenActionRequired={() => navigate('/', { replace: false })}
        onSelectType={(code) => {
          navigate(`/${code}`, { replace: false });
        }}
      />

      <div
        className={[
          'min-h-screen transition-[padding-left] duration-300 ease-out',
          drawerOpen ? 'md:pl-72' : 'md:pl-0',
        ].join(' ')}
      >
        <Header
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen((value) => !value)}
        />
        <main className="p-4 md:p-6">
          <Outlet context={{ types }} />
        </main>
      </div>
    </div>
  );
}
