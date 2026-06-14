import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Camera, Car, AlertTriangle, FileSearch,
  Users, Map, Menu, X, LogOut, ChevronRight, Shield, BarChart3, UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Estadísticas", href: "/estadisticas", icon: <BarChart3 size={18} /> }, // <-- ¡Este es tu nuevo botón!
  { label: "Detecciones", href: "/detecciones", icon: <FileSearch size={18} /> },
  { label: "Alertas", href: "/alertas", icon: <AlertTriangle size={18} /> },
  { label: "Vehículos", href: "/vehiculos", icon: <Car size={18} /> },
  { label: "Cámaras", href: "/camaras", icon: <Camera size={18} /> },
  { label: "Mapa", href: "/mapa", icon: <Map size={18} /> },
  { label: "Audiencias", href: "/audiencias", icon: <UsersRound size={18} /> },
  { label: "Usuarios", href: "/usuarios", icon: <Users size={18} />, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-[#2e4040]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#fc6c03] flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Dashboard LPR
            </p>
            <p className="text-[#6b8585] text-xs">Sistema de Placas</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                active
                  ? "bg-[#fc6c03] text-white font-medium"
                  : "text-[#8faaaa] hover:bg-[#2e4040] hover:text-white"
              )}
              data-testid={`nav-${item.href.replace("/", "")}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[#2e4040]">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-sm font-medium truncate">{user?.username}</p>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            user?.role === "administrador"
              ? "bg-[#fc6c03]/20 text-[#fc6c03]"
              : "bg-[#2e4040] text-[#8faaaa]"
          )}>
            {user?.role}
          </span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[#8faaaa] hover:text-white hover:bg-[#2e4040] px-3"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut size={16} />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f0f2f0] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-[#253232] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#253232] flex flex-col">
            <div className="flex justify-end p-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-white">
                <X size={20} />
              </Button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <p className="font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
            Dashboard LPR
          </p>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
