import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted-foreground">Ładowanie…</div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}
