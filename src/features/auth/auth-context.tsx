import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import type { AuthResponse, AuthUser } from '@/lib/http';
import {
  API_BASE_URL,
  bootstrapAuthUser,
  clearAuthTokens,
  getRefreshToken,
  postAuth,
  saveAuthTokens,
  requestJson,
} from '@/lib/http';

type LoginDto = {
  email: string;
  password: string;
};

type RegisterDto = {
  token: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

type ResetPasswordDto = {
  token: string;
  password: string;
};

type ForgotPasswordDto = {
  email: string;
};

type InviteDto = {
  email: string;
  role?: 'ADMIN' | 'USER';
};

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (dto: ForgotPasswordDto) => Promise<void>;
  registerWithInvite: (dto: RegisterDto) => Promise<void>;
  resetPassword: (dto: ResetPasswordDto) => Promise<void>;
  inviteUser: (dto: InviteDto) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const handleUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser>;
      setUser(customEvent.detail);
      setStatus('authenticated');
    };

    const handleCleared = () => {
      setUser(null);
      setStatus('unauthenticated');
    };

    window.addEventListener('auth:updated', handleUpdated);
    window.addEventListener('auth:cleared', handleCleared);

    return () => {
      window.removeEventListener('auth:updated', handleUpdated);
      window.removeEventListener('auth:cleared', handleCleared);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const bootstrapUser = await bootstrapAuthUser();

      if (cancelled) {
        return;
      }

      if (bootstrapUser) {
        setUser(bootstrapUser);
        setStatus('authenticated');
        return;
      }

      setUser(null);
      setStatus('unauthenticated');
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (dto) => {
        const response = await postAuth<AuthResponse>('/auth/login', dto);
        saveAuthTokens(response);
        setUser(response.user);
        setStatus('authenticated');
      },
      logout: async () => {
        try {
          const refreshToken = getRefreshToken();

          if (refreshToken) {
            await fetch(`${API_BASE_URL}/auth/logout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            }).catch(() => undefined);
          }
        } finally {
          clearAuthTokens();
          setUser(null);
          setStatus('unauthenticated');
          window.dispatchEvent(new Event('auth:cleared'));
          navigate('/login', { replace: true });
        }
      },
      forgotPassword: async (dto) => {
        await requestJson<boolean>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
      },
      registerWithInvite: async (dto) => {
        const response = await postAuth<AuthResponse>('/auth/register', dto);
        saveAuthTokens(response);
        setUser(response.user);
        setStatus('authenticated');
      },
      resetPassword: async (dto) => {
        await postAuth<boolean>('/auth/reset-password', dto);
      },
      inviteUser: async (dto) => {
        await requestJson<boolean>('/auth/invite', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
      },
    }),
    [navigate, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
