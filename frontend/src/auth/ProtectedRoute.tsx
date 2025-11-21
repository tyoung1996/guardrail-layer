import { Navigate } from "react-router-dom";

import { JSX } from "react";
import { useAuth } from "./AuthProvider";


export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}