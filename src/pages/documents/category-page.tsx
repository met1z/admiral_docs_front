import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, Loader2, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  requestJson,
  type DocumentListItem,
  type DocumentListResponse,
  type DocumentStatus,
  type DocumentType,
} from '@/lib/http';

type CategoryTab = 'active' | 'completed';
type SortKey =
  | 'created_desc'
  | 'created_asc'
  | 'creator_asc'
  | 'creator_desc'
  | 'revision_new_first'
  | 'revision_repeat_first';

const SORT_CONFIG: Record<SortKey, { sortBy: string; sortDirection: 'ASC' | 'DESC' }> = {
  created_desc: { sortBy: 'created_at', sortDirection: 'DESC' },
  created_asc: { sortBy: 'created_at', sortDirection: 'ASC' },
  creator_asc: { sortBy: 'creator_name', sortDirection: 'ASC' },
  creator_desc: { sortBy: 'creator_name', sortDirection: 'DESC' },
  revision_new_first: { sortBy: 'revision_type', sortDirection: 'ASC' },
  revision_repeat_first: { sortBy: 'revision_type', sortDirection: 'DESC' },
};

const SORT_LABELS: Record<SortKey, string> = {
  created_desc: 'documents.sort.createdDesc',
  created_asc: 'documents.sort.createdAsc',
  creator_asc: 'documents.sort.creatorAsc',
  creator_desc: 'documents.sort.creatorDesc',
  revision_new_first: 'documents.sort.newFirst',
  revision_repeat_first: 'documents.sort.repeatFirst',
};

function resolveDocumentType(types: DocumentType[], typeCode: string | undefined) {
  if (!typeCode) {
    return types[0] ?? null;
  }

  return types.find((type) => type.code === typeCode) ?? null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusLabel(status: DocumentStatus, t: (key: string) => string) {
  if (status === 'completed') {
    return t('documents.status.completed');
  }

  if (status === 'rejected') {
    return t('documents.status.rejected');
  }

  return t('documents.status.inProgress');
}

export function DocumentsCategoryPage() {
  const { t } = useTranslation();
  const { types } = useDocumentsMeta();
  const { typeCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeType = useMemo(() => resolveDocumentType(types, typeCode), [types, typeCode]);
  const [sortKey, setSortKey] = useState<SortKey>('created_desc');
  const [searchInput, setSearchInput] = useState('');
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const tab = searchParams.get('tab') === 'completed' ? 'completed' : 'active';
  const pageSize = 12;
  const activeSortConfig = SORT_CONFIG[sortKey];
  const activeSortLabel = SORT_LABELS[sortKey];

  function setTab(nextTab: CategoryTab) {
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === 'active') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    if (!sortMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    setDocuments([]);
    setPage(1);
    setHasMore(true);
  }, [activeType, debouncedSearch, sortKey, tab]);

  useEffect(() => {
    const resolvedType = activeType as DocumentType;

    if (!activeType || !hasMore) {
      return;
    }

    let cancelled = false;

    async function loadDocuments() {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      setLoading(page === 1);
      setError(null);

      try {
        const response = await requestJson<DocumentListResponse>(
          `/documents?typeId=${resolvedType.id}&statusGroup=${tab}&page=${page}&limit=${pageSize}&search=${encodeURIComponent(
            debouncedSearch.trim(),
          )}&sortBy=${activeSortConfig.sortBy}&sortDirection=${activeSortConfig.sortDirection}`,
          { method: 'GET' },
        );

        if (cancelled) {
          return;
        }

        setDocuments((current) => (page === 1 ? response.items : [...current, ...response.items]));
        setHasMore(response.items.length === pageSize && page * pageSize < response.total);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('documents.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          isFetchingRef.current = false;
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [activeType, activeSortConfig.sortBy, activeSortConfig.sortDirection, debouncedSearch, hasMore, page, pageSize, tab, t]);

  useEffect(() => {
    if (!hasMore || loading || error) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry?.isIntersecting && !isFetchingRef.current) {
          setPage((current) => current + 1);
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      },
    );

    const target = loadMoreRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
    };
  }, [error, hasMore, loading]);

  if (typeCode && !activeType && types.length > 0) {
    return <Navigate to="/" replace />;
  }

  if (!activeType) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-slate-500">{t('documents.errors.typeNotFound')}</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              {activeType.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {tab === 'completed' ? t('documents.completedTitle') : t('documents.activeTitle')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              {tab === 'completed'
                ? t('documents.completedDescription')
                : t('documents.activeDescription')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                tab === 'active'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              {t('documents.tabs.active')}
            </button>
            <button
              type="button"
              onClick={() => setTab('completed')}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                tab === 'completed'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              {t('documents.tabs.completed')}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('documents.searchPlaceholder')}
              className="pl-10"
            />
          </label>

          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setSortMenuOpen((value) => !value)}
              className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{t('documents.sortLabel')}</span>
              </span>
              <span className="hidden min-w-0 items-center gap-3 sm:flex">
                <span className="truncate text-slate-500">{t(activeSortLabel)}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 sm:hidden" />
            </button>

            {sortMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full min-w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                {([
                  ['created_desc', t('documents.sort.createdDesc')],
                  ['created_asc', t('documents.sort.createdAsc')],
                  ['creator_asc', t('documents.sort.creatorAsc')],
                  ['creator_desc', t('documents.sort.creatorDesc')],
                  ['revision_new_first', t('documents.sort.newFirst')],
                  ['revision_repeat_first', t('documents.sort.repeatFirst')],
                ] as Array<[SortKey, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortKey(key);
                      setSortMenuOpen(false);
                    }}
                    className={[
                      'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors',
                      sortKey === key
                        ? 'bg-cyan-50 text-cyan-900'
                        : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span>{label}</span>
                    {sortKey === key ? <Check className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">
              {t('documents.visibleCount', { count: documents.length })}
            </span>
          </div>
        </div>
      </div>

      {loading && page === 1 ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-4 text-xl font-semibold text-slate-950">{t('documents.empty.title')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('documents.empty.description')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {documents.map((document) => {
            const awaitingLabel =
              document.status === 'rejected'
                ? t('documents.awaiting.creator', { name: document.createdByFullName })
                : document.currentActionFullName
                  ? t('documents.awaiting.user', { name: document.currentActionFullName })
                  : t('documents.awaiting.none');

            return (
              <Link
                key={document.id}
                to={`/document/${document.id}`}
                className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {document.typeName ?? activeType.name}
                      </span>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800">
                        {document.revisionType === 'new'
                          ? t('documents.revision.new')
                          : t('documents.revision.repeat')}
                      </span>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                        {statusLabel(document.status, t)}
                      </span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 text-lg font-semibold text-slate-950">
                      {document.name}
                    </h3>
                  </div>

                  {document.requiresAction ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {t('documents.badges.actionRequired')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('documents.labels.creator')}</span>
                    <span className="text-right font-medium text-slate-900">
                      {document.createdByFullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('documents.labels.createdAt')}</span>
                    <span className="text-right font-medium text-slate-900">
                      {formatDateTime(document.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('documents.labels.waitingFor')}</span>
                    <span className="text-right font-medium text-slate-900">{awaitingLabel}</span>
                  </div>
                </div>

                {document.lastRejectionReason ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">{t('documents.labels.rejectionReason')}</p>
                    <p className="mt-1 leading-6">{document.lastRejectionReason}</p>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {hasMore ? <div ref={loadMoreRef} className="h-12" /> : null}
      {loading && page > 1 ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500 shadow-sm">
          {t('documents.searchLoading')}
        </div>
      ) : null}
      {!hasMore && documents.length > 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500 shadow-sm">
          {t('documents.endOfList')}
        </div>
      ) : null}
    </section>
  );
}
