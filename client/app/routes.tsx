import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { Layout } from '../components/Layout/Layout';
import { ChunkErrorBoundary } from '../components/ui/ChunkErrorBoundary';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { APP_PATHS } from './paths';

const HomePage = lazy(() =>
  import('../features/home/HomePage').then((mod) => ({
    default: mod.HomePage,
  })),
);
const AppDetailPage = lazy(() =>
  import('../features/fleet/AppDetailPage').then((mod) => ({
    default: mod.AppDetailPage,
  })),
);
const SignInPage = lazy(() =>
  import('../features/auth/SignInPage').then((mod) => ({
    default: mod.SignInPage,
  })),
);
const SignUpPage = lazy(() =>
  import('../features/auth/SignUpPage').then((mod) => ({
    default: mod.SignUpPage,
  })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted text-sm">Loading...</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <ChunkErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route
                path={APP_PATHS.home}
                element={
                  <ProtectedRoute requireAdmin>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path={APP_PATHS.appDetail}
                element={
                  <ProtectedRoute requireAdmin>
                    <AppDetailPage />
                  </ProtectedRoute>
                }
              />
              {/* Clerk path routing needs the wildcard for multi-step flows. */}
              <Route path={`${APP_PATHS.signIn}/*`} element={<SignInPage />} />
              <Route path={`${APP_PATHS.signUp}/*`} element={<SignUpPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </ErrorBoundary>
  );
}
