import { useEffect, useMemo, useRef, useState } from 'react';

import { GripVertical, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DocumentPreview } from '@/components/documents/document-preview';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentsMeta } from '@/features/documents/documents-meta-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatFileSize } from '@/lib/file-size';
import {
  requestJson,
  type DocumentStorageUploadResponse,
  type DocumentType,
  type UserSearchItem,
} from '@/lib/http';

type SelectedUser = UserSearchItem;

type ParticipantErrorState = {
  name?: string;
  file?: string;
  participants?: string;
};

function resolveType(types: DocumentType[], typeCode: string | undefined) {
  if (!typeCode) {
    return types[0] ?? null;
  }

  return types.find((type) => type.code === typeCode) ?? null;
}

function fileIsSupported(file: File) {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]);

  const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  return allowedMimeTypes.has(file.type) || allowedExtensions.includes(extension);
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) {
    return items;
  }

  next.splice(to, 0, item);
  return next;
}

export function CreateDocumentPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { types, homeType } = useDocumentsMeta();
  const { typeCode } = useParams();
  const navigate = useNavigate();

  const activeType = useMemo(() => resolveType(types, typeCode), [types, typeCode]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [participants, setParticipants] = useState<SelectedUser[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<ParticipantErrorState>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    window.matchMedia('(min-width: 768px)').matches,
  );

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopLayout(event.matches);
    };

    setIsDesktopLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setUploadPreview(null);
      setFileInfo(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadPreview(objectUrl);
    setFileInfo(file.name);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    let cancelled = false;

    async function searchUsers() {
      const query = debouncedSearch.trim();

      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);

      try {
        const results = await requestJson<SelectedUser[]>(
          `/users/search?query=${encodeURIComponent(query)}&limit=8`,
          { method: 'GET' },
        );

        if (!cancelled) {
          const selectedIds = new Set(participants.map((participant) => participant.id));
          setSearchResults(results.filter((result) => !selectedIds.has(result.id)));
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }

    void searchUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, participants]);

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

  const resolvedType = activeType;

  function addParticipant(item: SelectedUser) {
    setParticipants((current) => {
      if (current.some((participant) => participant.id === item.id)) {
        return current;
      }

      return [...current, item];
    });
    setSearchInput('');
    setSearchResults([]);
  }

  function removeParticipant(userId: number) {
    setParticipants((current) => current.filter((participant) => participant.id !== userId));
  }

  function validateForm() {
    const nextErrors: ParticipantErrorState = {};

    if (name.trim().length < 3) {
      nextErrors.name = t('documents.validation.name');
    }

    if (!file) {
      nextErrors.file = t('documents.validation.fileRequired');
    } else if (!fileIsSupported(file)) {
      nextErrors.file = t('documents.validation.fileType');
    } else if (file.size > 40 * 1024 * 1024) {
      nextErrors.file = t('documents.validation.fileSize');
    }

    if (participants.length === 0) {
      nextErrors.participants = t('documents.validation.participantsRequired');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm() || !file) {
      return;
    }

    setSubmitting(true);

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);

      const uploadedFile = await requestJson<DocumentStorageUploadResponse>('/documents/storage/upload', {
        method: 'POST',
        body: uploadForm,
      });

        const payload = {
        typeId: resolvedType.id,
        name: name.trim(),
        file: uploadedFile,
        participants: participants.map((participant, index) => ({
          userId: participant.id,
          participantType: 'signer',
          order: index + 1,
        })),
      };

      await requestJson<{ typeId: number }>('/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showToast({
        title: t('documents.createdToastTitle'),
        description: t('documents.createdToastDescription'),
        variant: 'success',
      });

      if (homeType && resolvedType.code === homeType.code) {
        navigate('/', { replace: true });
      } else {
        navigate(`/${resolvedType.code}`, { replace: true });
      }
    } catch (error) {
      showToast({
        title: t('documents.createFailedTitle'),
        ...(error instanceof Error ? { description: error.message } : {}),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 pb-28 sm:space-y-6 sm:pb-32">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
          {resolvedType.name}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {t('documents.createTitle')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:leading-7">
          {t('documents.createDescription')}
        </p>
      </div>

      <form id="create-document-form" className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">{t('documents.fields.name')}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('documents.placeholders.name')}
            />
          </label>
          {errors.name ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errors.name}
            </p>
          ) : null}

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{t('documents.fields.file')}</span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-cyan-300 hover:bg-cyan-50/40 sm:px-6 sm:py-10">
              <Upload className="h-7 w-7 text-slate-400 sm:h-8 sm:w-8" />
              <span className="mt-3 text-sm font-medium text-slate-900">
                {t('documents.upload.title')}
              </span>
              <span className="mt-1 text-sm leading-6 text-slate-500">{t('documents.upload.subtitle')}</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {fileInfo ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm sm:h-12 sm:w-12">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {t('documents.filePreview.name')}
                    </p>
                    <p className="block max-w-full break-all text-sm font-semibold text-slate-950">
                      {fileInfo}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <div className="min-w-0 overflow-hidden rounded-xl bg-white px-3 py-2">
                      <span className="block font-medium text-slate-500">
                        {t('documents.filePreview.size')}
                      </span>
                      <span className="block min-w-0 text-slate-900">
                        {file ? formatFileSize(file.size) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                {file ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="self-end sm:self-auto"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              {uploadPreview && file?.type.startsWith('image/') ? (
                <img
                  src={uploadPreview}
                  alt={file.name}
                  className="mt-4 max-h-64 w-full rounded-2xl object-contain bg-white"
                />
              ) : null}
            </div>
          ) : null}

          {errors.file ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errors.file}
            </p>
          ) : null}
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">{t('documents.fields.participants')}</span>
                <span className="text-xs text-slate-500">
                  {t('documents.participantCount', { count: participants.length })}
                </span>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t('documents.participantSearch')}
                  className="pl-10"
                />
              </label>
            </div>

            {searchLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                {t('documents.searchLoading')}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => addParticipant(result)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{result.fullName}</span>
                      <span className="block text-xs text-slate-500">{result.email}</span>
                    </span>
                    <span className="text-xs text-cyan-700">{t('actions.add')}</span>
                  </button>
                ))}
              </div>
            ) : searchInput.trim().length >= 2 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                {t('documents.searchEmpty')}
              </div>
            ) : null}

            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div
                  key={participant.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null || dragIndex === index) {
                      return;
                    }

                    setParticipants((current) => moveItem(current, dragIndex, index));
                    setDragIndex(null);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4"
                >
                  <GripVertical className="h-5 w-5 shrink-0 text-slate-300" />
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-50 text-sm font-semibold text-cyan-800">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{participant.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{participant.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeParticipant(participant.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {errors.participants ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errors.participants}
              </p>
            ) : null}
          </div>
        </div>

      </form>

      <div
        className={[
          'fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] -translate-x-1/2 sm:bottom-6 sm:w-auto sm:max-w-none',
          isDesktopLayout ? 'md:left-auto md:right-6 md:translate-x-0' : 'md:left-1/2 md:-translate-x-1/2',
        ].join(' ')}
      >
        <div className="rounded-full border border-slate-200 bg-white p-2 shadow-[0_16px_50px_rgba(15,23,42,0.14)]">
          <Button
            className="w-full min-w-56 rounded-full px-6 sm:w-auto"
            type="submit"
            form="create-document-form"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('documents.creating')}
              </>
            ) : (
              t('documents.createSubmit')
            )}
          </Button>
        </div>
      </div>

      {file && uploadPreview ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <DocumentPreview
            title={resolvedType.name}
            source={{
              mimeType: file.type,
              originalFileName: file.name,
              sizeBytes: file.size,
              previewUrl: null,
              downloadUrl: null,
              localUrl: uploadPreview,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
