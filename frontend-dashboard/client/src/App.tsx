import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Detecciones from "@/pages/Detecciones";
import Alertas from "@/pages/Alertas";
import Vehiculos from "@/pages/Vehiculos";
import Camaras from "@/pages/Camaras";
import Simulador from "@/pages/Simulador";
import Usuarios from "@/pages/Usuarios";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/detecciones">
        <ProtectedRoute><Detecciones /></ProtectedRoute>
      </Route>
      <Route path="/alertas">
        <ProtectedRoute><Alertas /></ProtectedRoute>
      </Route>
      <Route path="/vehiculos">
        <ProtectedRoute><Vehiculos /></ProtectedRoute>
      </Route>
      <Route path="/camaras">
        <ProtectedRoute><Camaras /></ProtectedRoute>
      </Route>
      <Route path="/simulador">
        <ProtectedRoute><Simulador /></ProtectedRoute>
      </Route>
      <Route path="/usuarios">
        <ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>
      </Route>
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
