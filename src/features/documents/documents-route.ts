import type { DocumentType } from '@/lib/http';

export function documentTypeRoute(type: DocumentType | null | undefined): string {
  if (!type) {
    return '/';
  }

  const firstType = type.code;

  return firstType;
}

export function getDocumentTypePath(typeCode: string): string {
  return `/${typeCode}`;
}

export function getCreateDocumentPath(typeCode: string): string {
  return `/create/${typeCode}`;
}
