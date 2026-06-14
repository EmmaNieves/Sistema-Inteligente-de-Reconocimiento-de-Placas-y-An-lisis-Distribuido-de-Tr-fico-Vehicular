import { useQuery } from "@tanstack/react-query";
import { api, DashboardStats, Plate, Alerta } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Camera, Car, FileSearch, AlertTriangle, CheckCircle2,
  XCircle, Activity, Clock
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function StatCard({
  title, value, icon, color, sub
}: { title: string; value: number | string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <Card className="bg-white border-0 shadow-sm rounded-2xl">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[#253232]" data-testid={`stat-${title.toLowerCase().replace(/ /g, "-")}`}>
            {value}
          </p>
          <p className="text-sm text-gray-500">{title}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => api.dashboardStats(),
  });

  const { data: detections, isLoading: loadingDet } = useQuery<Plate[]>({
    queryKey: ["/api/dashboard/recent-detections"],
    queryFn: () => api.recentDetections(),
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<Alerta[]>({
    queryKey: ["/api/dashboard/recent-alerts"],
    queryFn: () => api.recentAlerts(),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-500">Resumen del sistema de reconocimiento de placas</p>
        </div>

        {/* Stats grid */}
        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Total Detecciones" value={stats?.total_detections ?? 0} icon={<FileSearch size={22} className="text-blue-600" />} color="bg-blue-50" />
            <StatCard title="Autorizadas" value={stats?.authorized ?? 0} icon={<CheckCircle2 size={22} className="text-green-600" />} color="bg-green-50" />
            <StatCard title="No Autorizadas" value={stats?.unauthorized ?? 0} icon={<XCircle size={22} className="text-red-600" />} color="bg-red-50" />
            <StatCard title="Alertas Abiertas" value={stats?.open_alerts ?? 0} icon={<AlertTriangle size={22} className="text-orange-600" />} color="bg-orange-50" />
            <StatCard title="Vehículos Registrados" value={stats?.registered_vehicles ?? 0} icon={<Car size={22} className="text-purple-600" />} color="bg-purple-50" />
            <StatCard title="Cámaras Activas" value={stats?.active_cameras ?? 0} icon={<Camera size={22} className="text-teal-600" />} color="bg-teal-50" />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent detections */}
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-[#253232] flex items-center gap-2">
                <Activity size={16} className="text-[#fc6c03]" /> Últimas Detecciones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDet ? (
                <div className="p-4 space-y-2">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : !detections?.length ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin detecciones recientes</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {detections.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-5 py-3" data-testid={`row-detection-${d.id}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.authorized ? "bg-green-500" : "bg-red-500"}`} />
                        <div>
                          <p className="text-sm font-semibold text-[#253232] font-mono">{d.plate_text}</p>
                          <p className="text-xs text-gray-400">{d.vehicle_type || "—"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.authorized ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {d.authorized ? "Autorizado" : "No autorizado"}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 justify-end">
                          <Clock size={10} />
                          {format(new Date(d.detection_timestamp), "dd MMM HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent alerts */}
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-[#253232] flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#fc6c03]" /> Últimas Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAlerts ? (
                <div className="p-4 space-y-2">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : !alerts?.length ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin alertas recientes</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {alerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3" data-testid={`row-alert-${a.id}`}>
                      <div>
                        <p className="text-sm font-semibold text-[#253232] font-mono">{a.plate_text}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(a.fecha), "dd MMM HH:mm", { locale: es })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.estado_envio === "enviado" ? "bg-green-100 text-green-700"
                          : a.estado_envio === "fallido" ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {a.estado_envio}
                        </span>
                        {a.resolved && (
                          <span className="text-xs text-gray-400">resuelta</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
