import { deleteCookie, getCookie, setCookie } from './cookies';

const apiBaseUrl = import.meta.env.VITE_API_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_URL is not set');
}

export const API_BASE_URL = apiBaseUrl;

const ACCESS_TOKEN_COOKIE = 'admiral_access_token';
const REFRESH_TOKEN_COOKIE = 'admiral_refresh_token';
const MAX_AGE_ACCESS = 60 * 60 * 24;
const MAX_AGE_REFRESH = 60 * 60 * 24 * 30;

export type AuthUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'ADMIN' | 'USER';
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type DocumentType = {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
};

export type DocumentRevisionType = 'new' | 'repeat';

export type DocumentStatus = 'in_progress' | 'rejected' | 'completed';

export type DocumentParticipantType = 'signer' | 'additional_approver';

export type DocumentParticipantStatus = 'pending' | 'completed' | 'rejected';

export type DocumentListItem = {
  id: number;
  typeId: number;
  typeName: string | null;
  createdByUserId: number;
  createdByFullName: string;
  name: string;
  status: DocumentStatus;
  revisionType: DocumentRevisionType;
  submissionRound: number;
  lastRejectionReason: string | null;
  lastRejectedByUserId: number | null;
  lastRejectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requiresAction: boolean;
  myParticipantId: number | null;
  myParticipantStatus: DocumentParticipantStatus | null;
  myParticipantType: DocumentParticipantType | null;
  currentActionParticipantId: number | null;
  currentActionUserId: number | null;
  currentActionFullName: string | null;
  currentActionParticipantType: DocumentParticipantType | null;
};

export type DocumentListResponse = {
  items: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
};

export type UserSearchItem = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
};

export type DocumentStorageUploadResponse = {
  mimeType: string;
  storageKey: string;
  url: string;
  originalFileName: string;
  sizeBytes: number;
};

export type DocumentDetailFile = {
  id: number;
  storageKey: string | null;
  mimeType: string;
  isCurrent: boolean;
  url: string;
  originalFileName: string;
  sizeBytes: string;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export type DocumentDetailParticipant = {
  id: number;
  userId: number;
  userEmail: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  participantType: DocumentParticipantType;
  order: number;
  addedByUserId: number | null;
  isPreservedAfterRejection: boolean;
  signedStatus: DocumentParticipantStatus;
  createdAt: string;
  updatedAt: string;
  isCurrentAction: boolean;
};

export type DocumentDetailHistoryItem = {
  id: number;
  actorUserId: number;
  actorFullName: string;
  participantId: number | null;
  targetUserId: number | null;
  targetFullName: string | null;
  eventType: string;
  message: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type DocumentDetailResponse = {
  id: number;
  typeId: number;
  typeName: string | null;
  createdByUserId: number;
  createdByFullName: string;
  name: string;
  status: DocumentStatus;
  revisionType: DocumentRevisionType;
  submissionRound: number;
  lastRejectionReason: string | null;
  lastRejectedByUserId: number | null;
  lastRejectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentFile: DocumentDetailFile | null;
  participants: DocumentDetailParticipant[];
  history: DocumentDetailHistoryItem[];
  requiresAction: boolean;
  myParticipantId: number | null;
  myParticipantStatus: DocumentParticipantStatus | null;
  myParticipantType: DocumentParticipantType | null;
  currentActionFullName: string | null;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload.trim() || fallback;
  }

  if (Array.isArray(payload)) {
    const messages = payload
      .map((item) => extractErrorMessage(item, ''))
      .filter((message) => message.length > 0);

    return messages.length > 0 ? messages.join('\n') : fallback;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }

    if (Array.isArray(record.message)) {
      const messages = record.message
        .map((item) => extractErrorMessage(item, ''))
        .filter((message) => message.length > 0);

      if (messages.length > 0) {
        return messages.join('\n');
      }
    }

    if (Array.isArray(record.messages)) {
      const messages = record.messages
        .map((item) => extractErrorMessage(item, ''))
        .filter((message) => message.length > 0);

      if (messages.length > 0) {
        return messages.join('\n');
      }
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
  }

  return fallback;
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_COOKIE);
}

export function saveAuthTokens(response: AuthResponse) {
  setCookie(ACCESS_TOKEN_COOKIE, response.accessToken, MAX_AGE_ACCESS);
  setCookie(REFRESH_TOKEN_COOKIE, response.refreshToken, MAX_AGE_REFRESH);
}

export function clearAuthTokens() {
  deleteCookie(ACCESS_TOKEN_COOKIE);
  deleteCookie(REFRESH_TOKEN_COOKIE);
}

export function getAuthHeader() {
  const token = getAccessToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function dispatchAuthUpdated(user: AuthUser) {
  window.dispatchEvent(new CustomEvent<AuthUser>('auth:updated', { detail: user }));
}

function dispatchAuthCleared() {
  window.dispatchEvent(new Event('auth:cleared'));
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function silentLogout() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearAuthTokens();
    dispatchAuthCleared();
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore silent logout failures.
  } finally {
    clearAuthTokens();
    dispatchAuthCleared();
  }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return false;
  }

  const authResponse = (await response.json()) as AuthResponse;
  saveAuthTokens(authResponse);
  dispatchAuthUpdated(authResponse.user);
  return true;
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const body = init.body;

  if (body && !isFormData(body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...Object.fromEntries(headers.entries()),
      ...getAuthHeader(),
    },
  });

  if (response.ok) {
    return parseResponse<T>(response);
  }

  if (response.status === 401) {
    const refreshed = await refreshSession();

    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...Object.fromEntries(headers.entries()),
          ...getAuthHeader(),
        },
      });

      if (retryResponse.ok) {
        return parseResponse<T>(retryResponse);
      }

      if (retryResponse.status === 401) {
        await silentLogout();
      }

      const retryPayload = await parseResponse<unknown>(retryResponse);
      throw new ApiError(
        extractErrorMessage(retryPayload, retryResponse.statusText || 'Unauthorized'),
        retryResponse.status,
        retryPayload,
      );
    }

    await silentLogout();
  }

  const payload = await parseResponse<unknown>(response);
  throw new ApiError(
    extractErrorMessage(payload, response.statusText || 'Request failed'),
    response.status,
    payload,
  );
}

export async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await parseResponse<unknown>(response);
    throw new ApiError(
      extractErrorMessage(payload, response.statusText || 'Request failed'),
      response.status,
      payload,
    );
  }

  return parseResponse<T>(response);
}

export async function bootstrapAuthUser() {
  const hasTokens = Boolean(getAccessToken() || getRefreshToken());

  if (!hasTokens) {
    return null;
  }

  try {
    return await requestJson<AuthUser>('/auth/me', {
      method: 'GET',
    });
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken() || getRefreshToken());
}
