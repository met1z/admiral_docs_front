export type DocumentPreviewSource = {
  mimeType: string | null;
  originalFileName: string | null;
  sizeBytes: number | string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  localUrl: string | null;
  localFile?: Blob | null;
  docxPreviewStatus?: 'loading' | 'error' | null;
};

export type BuildDocumentPreviewSourceInput = {
  mimeType: string | null;
  originalFileName: string | null;
  sizeBytes: number | string | null;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  localUrl?: string | null;
  localFile?: Blob | null;
  docxPreviewStatus?: 'loading' | 'error' | null;
};

export function buildDocumentPreviewSource(
  input: BuildDocumentPreviewSourceInput | null,
): DocumentPreviewSource | null {
  if (!input) {
    return null;
  }

  return {
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    sizeBytes: input.sizeBytes,
    previewUrl: input.previewUrl ?? null,
    downloadUrl: input.downloadUrl ?? null,
    localUrl: input.localUrl ?? null,
    localFile: input.localFile ?? null,
    docxPreviewStatus: input.docxPreviewStatus ?? null,
  };
}
