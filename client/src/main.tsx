import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import { Landing } from "./pages/Landing";
import { Login, Signup } from "./pages/Auth";
import { ProjectList } from "./pages/ProjectList";
import { useAuthStore } from "./stores/authStore";
import "./index.css";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (!user && !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Root() {
  const loadSession = useAuthStore((s) => s.loadSession);
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/app" element={<AuthGuard><ProjectList /></AuthGuard>} />
        <Route path="/app/new" element={<AuthGuard><App /></AuthGuard>} />
        <Route path="/app/project/:projectId" element={<AuthGuard><App /></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
