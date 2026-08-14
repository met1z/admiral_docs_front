import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { PublicOnly } from '@/components/layout/public-only';
import { RequireAuth } from '@/components/layout/require-auth';
import { DocumentsMetaProvider } from '@/features/documents/documents-meta-context';
import { DocumentsCategoryPage } from '@/pages/documents/category-page';
import { CreateDocumentPage } from '@/pages/documents/create-document-page';
import { DocumentDetailPage } from '@/pages/documents/document-detail-page';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <DocumentsMetaProvider>
              <AppShell />
            </DocumentsMetaProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DocumentsCategoryPage />} />
        <Route path=":typeCode" element={<DocumentsCategoryPage />} />
        <Route path="create/:typeCode" element={<CreateDocumentPage />} />
        <Route path="document/:id" element={<DocumentDetailPage />} />
      </Route>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register/:token"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          <PublicOnly>
            <ResetPasswordPage />
          </PublicOnly>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
