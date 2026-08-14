import { useEffect, useMemo, useState } from 'react';

import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';

export function AppShell() {
  const { types, isLoading, homeType } = useDocumentsMeta();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(() => window.innerWidth >= 768);

  const activeTypeCode = useMemo(() => {
    const path = location.pathname;

    if (path.startsWith('/create/')) {
      return path.split('/')[2] ?? homeType?.code ?? null;
    }

    const segment = path.split('/')[1];

    if (!segment) {
      return homeType?.code ?? null;
    }

    return segment;
  }, [homeType?.code, location.pathname]);

  const activeType = types.find((type) => type.code === activeTypeCode) ?? null;

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
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Завантажуємо типи документів...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        types={types}
        activeTypeCode={activeTypeCode}
        homeTypeCode={homeType?.code ?? null}
        onSelectType={(code) => {
          if (homeType && code === homeType.code) {
            navigate('/', { replace: false });
            return;
          }

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
          activeType={activeType}
        />
        <main className="p-4 md:p-6">
          <Outlet context={{ types, homeType }} />
        </main>
      </div>
    </div>
  );
}
