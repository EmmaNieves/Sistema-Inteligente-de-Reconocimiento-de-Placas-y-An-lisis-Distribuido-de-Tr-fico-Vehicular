import { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#253232] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#fc6c03] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (adminOnly && user.role !== "administrador") return <Redirect to="/dashboard" />;

  return <>{children}</>;
}
