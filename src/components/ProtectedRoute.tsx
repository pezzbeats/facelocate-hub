import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, isAdmin } = useSecureAuth();

  console.log('ProtectedRoute state:', { user: !!user, loading, isAdmin });


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found, redirecting to login');
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    console.log('User is not admin, showing access denied');
    return (
      <div className="min-h-screen bg-gradient-kiosk flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;