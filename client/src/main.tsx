import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import App from "./App";
import { Landing } from "./pages/Landing";
import { Login, Signup } from "./pages/Auth";
import { ProjectList } from "./pages/ProjectList";
import { CreatorsPage, HowItWorksPage, ManufacturingPage, MarketplacePage } from "./pages/SitePages";
import { AnalyticsConsent } from "./components/AnalyticsConsent";
import { ToastDeck } from "./components/ToastDeck";
import { PUBLIC_DEMO_PATH, PUBLIC_SITE, ROUTER_BASENAME } from "./lib/runtime";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { ThemeProvider, bootstrapTheme } from "./lib/theme";
import { useAuthStore } from "./stores/authStore";
import "./index.css";

const LazyPublicDemo = lazy(async () => ({
  default: (await import("./pages/PublicDemo")).PublicDemo,
}));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const initialized = useAuthStore((s) => s.initialized);
  if (PUBLIC_SITE) return <Navigate to={PUBLIC_DEMO_PATH} replace />;
  if (token && !initialized) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="surface-panel rounded-[24px] px-6 py-5 text-[13px] text-[var(--text-secondary)]">
          Restoring authenticated workspace…
        </div>
      </div>
    );
  }
  if (!user && !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RouteAnalytics() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

function Root() {
  const loadSession = useAuthStore((s) => s.loadSession);
  useEffect(() => {
    if (!PUBLIC_SITE) {
      loadSession();
    }
  }, [loadSession]);

  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <RouteAnalytics />
      <Suspense fallback={<div className="min-h-screen bg-[var(--bg-root)]" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/creators" element={<CreatorsPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          <Route path={PUBLIC_DEMO_PATH} element={<LazyPublicDemo />} />
          {PUBLIC_SITE ? (
            <>
              <Route path="/login" element={<Navigate to={PUBLIC_DEMO_PATH} replace />} />
              <Route path="/signup" element={<Navigate to={PUBLIC_DEMO_PATH} replace />} />
              <Route path="/app" element={<Navigate to={PUBLIC_DEMO_PATH} replace />} />
              <Route path="/app/new" element={<Navigate to={PUBLIC_DEMO_PATH} replace />} />
              <Route path="/app/project/:projectId" element={<Navigate to={PUBLIC_DEMO_PATH} replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/app" element={<AuthGuard><ProjectList /></AuthGuard>} />
              <Route path="/app/new" element={<AuthGuard><App /></AuthGuard>} />
              <Route path="/app/project/:projectId" element={<AuthGuard><App /></AuthGuard>} />
            </>
          )}
        </Routes>
      </Suspense>
      <AnalyticsConsent />
      <ToastDeck />
    </BrowserRouter>
  );
}

bootstrapTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </StrictMode>
);
