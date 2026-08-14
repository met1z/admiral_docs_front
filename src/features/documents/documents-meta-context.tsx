import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { requestJson, type DocumentType } from '@/lib/http';

type DocumentsMetaContextValue = {
  types: DocumentType[];
  isLoading: boolean;
  getTypeByCode: (code: string | undefined) => DocumentType | null;
  getTypeById: (id: number | null | undefined) => DocumentType | null;
  homeType: DocumentType | null;
};

const DocumentsMetaContext = createContext<DocumentsMetaContextValue | null>(null);

export function DocumentsMetaProvider({ children }: { children: React.ReactNode }) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        const items = await requestJson<DocumentType[]>('/documents/types', { method: 'GET' });
        if (!cancelled) {
          setTypes(items);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DocumentsMetaContextValue>(
    () => ({
      types,
      isLoading,
      getTypeByCode: (code) => types.find((type) => type.code === code) ?? null,
      getTypeById: (id) => types.find((type) => type.id === id) ?? null,
      homeType: types[0] ?? null,
    }),
    [isLoading, types],
  );

  return <DocumentsMetaContext.Provider value={value}>{children}</DocumentsMetaContext.Provider>;
}

export function useDocumentsMeta() {
  const context = useContext(DocumentsMetaContext);

  if (!context) {
    throw new Error('useDocumentsMeta must be used within DocumentsMetaProvider');
  }

  return context;
}
