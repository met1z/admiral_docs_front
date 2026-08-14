import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import './i18n';
import App from './App';
import './styles.css';
import { AuthProvider } from './features/auth/auth-context';
import { ToastProvider } from './components/ui/toast';

function DocumentMeta() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('meta.title');

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', t('meta.description'));
    }
  }, [t]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <DocumentMeta />
        <App />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
);
