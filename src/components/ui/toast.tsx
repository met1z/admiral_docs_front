import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CheckCircle2, CircleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ToastVariant = 'success' | 'error';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = Omit<ToastItem, 'id'>;

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { t } = useTranslation();

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast: (toast) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((current) => [...current, { id, ...toast }]);

        window.setTimeout(() => {
          setToasts((current) => current.filter((item) => item.id !== id));
        }, 3500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-3 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl',
              'animate-[toast-in_220ms_ease-out]',
              toast.variant === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50',
            ].join(' ')}
          >
            <div
              className={[
                'mt-0.5 grid h-8 w-8 place-items-center rounded-full',
                toast.variant === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700',
              ].join(' ')}
            >
              {toast.variant === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <CircleAlert className="h-4 w-4" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={[
                  'text-sm font-semibold',
                  toast.variant === 'success' ? 'text-emerald-900' : 'text-red-900',
                ].join(' ')}
              >
                {toast.title}
              </p>
              {toast.description ? (
                <p
                  className={[
                    'mt-1 whitespace-pre-line text-sm leading-6',
                    toast.variant === 'success' ? 'text-emerald-800' : 'text-red-800',
                  ].join(' ')}
                >
                  {toast.description}
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 shrink-0"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              aria-label={t('actions.closeToast')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
