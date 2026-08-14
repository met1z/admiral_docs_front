const BYTE_UNITS = [
  { limit: 1024 },
  { limit: 1024 * 1024 },
  { limit: 1024 * 1024 * 1024 },
  { limit: Number.POSITIVE_INFINITY },
] as const;

function toNumber(sizeBytes: number | string | null | undefined) {
  if (typeof sizeBytes === 'number') {
    return sizeBytes;
  }

  if (typeof sizeBytes === 'string') {
    const parsed = Number(sizeBytes);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatFileSize(sizeBytes: number | string | null | undefined): string {
  const value = toNumber(sizeBytes);

  if (!Number.isFinite(value) || value <= 0) {
    return '0 Б';
  }

  if (value < BYTE_UNITS[0].limit) {
    return `${value} Б`;
  }

  const kb = value / 1024;
  if (value < BYTE_UNITS[1].limit) {
    return `${kb.toFixed(kb < 10 ? 1 : 0)} КБ`;
  }

  const mb = value / 1024 / 1024;
  if (value < BYTE_UNITS[2].limit) {
    return `${mb.toFixed(mb < 10 ? 1 : 0)} МБ`;
  }

  const gb = value / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb < 10 ? 1 : 0)} ГБ`;
}
