import { Download, ExternalLink, FileText, FileImage, FileType2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { buttonVariants } from '@/components/ui/button';
import { formatFileSize } from '@/lib/file-size';

type DocumentPreviewSource = {
  mimeType: string | null;
  originalFileName: string | null;
  sizeBytes: number | string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  localUrl: string | null;
};

type DocumentPreviewProps = {
  source: DocumentPreviewSource | null;
  title?: string;
  className?: string;
};

function getExtension(fileName: string | null) {
  return fileName?.split('.').pop()?.toLowerCase() ?? '';
}

function isImage(mimeType: string, fileName: string | null) {
  return mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(getExtension(fileName));
}

function isPdf(mimeType: string, fileName: string | null) {
  return mimeType === 'application/pdf' || getExtension(fileName) === 'pdf';
}

function isWord(mimeType: string, fileName: string | null) {
  const extension = getExtension(fileName);

  return (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'doc' ||
    extension === 'docx'
  );
}

function getOfficeViewerUrl(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function DocumentPreview({ source, title, className }: DocumentPreviewProps) {
  const { t } = useTranslation();

  if (!source) {
    return null;
  }

  const { mimeType, originalFileName, previewUrl, downloadUrl, localUrl, sizeBytes } = source;
  const resolvedMimeType = mimeType || '';
  const resolvedUrl = previewUrl ?? localUrl;
  const canOpenInOffice = Boolean(previewUrl) && isWord(resolvedMimeType, originalFileName);

  const previewNode = (() => {
    if (resolvedUrl && isImage(resolvedMimeType, originalFileName)) {
      return (
        <img
          src={resolvedUrl}
          alt={originalFileName ?? title ?? ''}
          className="absolute inset-0 h-full w-full object-contain"
        />
      );
    }

    if (resolvedUrl && isPdf(resolvedMimeType, originalFileName)) {
      return (
        <iframe
          src={resolvedUrl}
          title={originalFileName ?? title ?? t('documents.preview.title')}
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      );
    }

    if (canOpenInOffice && previewUrl) {
      return (
        <iframe
          src={getOfficeViewerUrl(previewUrl)}
          title={originalFileName ?? title ?? t('documents.preview.title')}
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
          {isImage(resolvedMimeType, originalFileName) ? (
            <FileImage className="h-8 w-8" />
          ) : isPdf(resolvedMimeType, originalFileName) ? (
            <FileText className="h-8 w-8" />
          ) : isWord(resolvedMimeType, originalFileName) ? (
            <FileType2 className="h-8 w-8" />
          ) : (
            <FileText className="h-8 w-8" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{t('documents.preview.unavailableTitle')}</p>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            {isWord(resolvedMimeType, originalFileName)
              ? t('documents.preview.wordUnavailable')
              : t('documents.preview.genericUnavailable')}
          </p>
        </div>
      </div>
    );
  })();

  return (
    <section className={['space-y-4', className ?? ''].join(' ').trim()}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
            {t('documents.preview.title')}
          </p>
          <h2 className="mt-0.5 block w-full min-w-0 truncate text-base font-semibold text-slate-950 sm:text-[1.05rem]">
            {originalFileName ?? title ?? t('documents.preview.fallbackName')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(sizeBytes)}</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-1.5 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end">
          {previewUrl ?? localUrl ? (
            <a
              href={previewUrl ?? localUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline' }) + ' w-full min-w-0 sm:w-auto'}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{t('documents.preview.open')}</span>
            </a>
          ) : null}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline' }) + ' w-full min-w-0 sm:w-auto'}
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{t('documents.preview.download')}</span>
            </a>
          ) : null}
        </div>
      </div>

      <div className="relative h-[34rem] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-inner sm:h-[40rem] lg:h-[48rem]">
        {previewNode}
      </div>
    </section>
  );
}
