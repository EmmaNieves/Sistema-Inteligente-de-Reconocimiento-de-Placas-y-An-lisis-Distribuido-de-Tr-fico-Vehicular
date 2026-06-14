import { Layout } from "@/components/Layout";
import { Filter, Download, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, EstadisticasStats } from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

// Estos datos se mantienen porque son fijos para la interfaz (días y horas)
const hours = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
const days  = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const heatColors: Record<number, string> = { 0: "#F3F4F6", 1: "#FEFCE8", 2: "#FEF9C3", 3: "#FDE68A", 4: "#FB923C", 5: "#EA580C" };

export default function Estadisticas() {
  
  // 1. PETICIÓN AL BACKEND: Pedimos los datos al servidor que acabas de configurar
  const { data: stats, isLoading, error } = useQuery<EstadisticasStats>({
    queryKey: ["/api/estadisticas"],
    queryFn: () => api.estadisticas(),
  });

  // 2. ESTADO DE CARGA: Qué mostrar mientras el servidor responde
  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-[#6B7280]">
          <Loader2 className="w-10 h-10 animate-spin text-[#FC6C03]" />
          <p className="font-medium text-lg">Cargando estadísticas en tiempo real...</p>
        </div>
      </Layout>
    );
  }

  // 3. ESTADO DE ERROR: Si el backend falla
  if (error) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex flex-col gap-2 p-6 text-red-600 bg-red-50 rounded-2xl border border-red-200">
            <AlertCircle className="w-8 h-8" />
            <h2 className="font-bold text-lg">Error de conexión</h2>
            <p>No se pudieron cargar los datos desde el servidor. Verifica que el backend esté corriendo.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 4. CÁLCULOS EN VIVO: Calculamos los números grandes en base a la BD
  const totalAuth = stats?.totalAuthorized || 0;
  const totalDenied = stats?.totalDenied || 0;
  const totalDetections = stats?.totalDetections || totalAuth + totalDenied;
  // Calculamos el porcentaje real de autorizados
  const authPercentage = totalDetections > 0 ? Math.round((totalAuth / totalDetections) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-[1040px] mx-auto pt-4 pb-20 flex flex-col gap-12">

        {/* ─── BLOQUE 1: Información Técnica ─────────────── */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 style={{ fontFamily: "'Fredoka One', cursive" }} className="text-[36px] font-bold text-[#111827]">
              Información Técnica del Sistema
            </h1>
            <p className="text-[14px] text-[#6B7280]">Monitoreo en tiempo real del estado de los nodos</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-none w-full md:w-[314px] bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-6">
               <h2 className="font-bold text-[18px] text-[#1F2937] mb-4">Estado de Nodos</h2>
               <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-4 flex gap-3 mb-3">
                  <div className="w-[10px] h-[10px] bg-[#22C55E] rounded-full mt-1.5" />
                  <div>
                    <span className="text-[13px] font-bold block">FastAPI Node</span>
                    <span className="text-[12px] text-[#6B7280]">Memoria: 2.1 GB | CPU: 23%</span>
                  </div>
               </div>
               <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-4 flex gap-3">
                  <div className="w-[10px] h-[10px] bg-[#22C55E] rounded-full mt-1.5" />
                  <div>
                    <span className="text-[13px] font-bold block">Supabase Node</span>
                    <span className="text-[12px] text-[#6B7280]">Conexiones: 12/50 | Latencia: 8ms</span>
                  </div>
               </div>
            </div>

            <div className="flex-1 bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-6">
              <h2 className="font-bold text-[18px] text-[#1F2937] mb-4">Tendencia: Confianza promedio</h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.processingData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <CartesianGrid vertical={false} stroke="#F3F4F6" />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#FC6C03" fill="#FC6C03" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-[#E5E7EB]" />

        {/* ─── BLOQUE 2: Panel de Estadísticas ───────────────────────── */}
                <section className="flex flex-col gap-6">
                <h2 style={{ fontFamily: "'Fredoka One', cursive" }} className="text-[32px] text-[#111827]">Panel de Estadísticas</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    
                    {/* Tarjeta 1: Detecciones Reales */}
                    <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-5">
                    <span className="text-[13px] text-[#6B7280] block mb-1">Detecciones Hoy (BD)</span>
                    <div className="font-bold text-2xl text-[#111827]">{stats?.totalDetections || 0}</div>
                    </div>

                    {/* Tarjeta 2: Confianza real calculada desde OCR/YOLO */}
                    <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-5">
                    <span className="text-[13px] text-[#6B7280] block mb-1">Confianza Promedio</span>
                    <div className="font-bold text-2xl text-[#111827]">{stats?.averageConfidence || 0}%</div>
                    </div>

                    {/* Tarjeta 3: Cámaras Activas Reales */}
                    <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-5">
                    <span className="text-[13px] text-[#6B7280] block mb-1">Cámaras Activas</span>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-2xl text-[#111827]">{stats?.activeCameras || 0}</span>
                        {(stats?.inactiveCameras || 0) > 0 && (
                        <span className="bg-[#FFF7ED] text-[#C2410C] rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            {stats?.inactiveCameras} en falla
                        </span>
                        )}
                    </div>
                    </div>

                    {/* Tarjeta 4: Alertas Reales */}
                    <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-5">
                    <span className="text-[13px] text-[#6B7280] block mb-1">Alertas Activas</span>
                    <div className="font-bold text-2xl text-red-600">{stats?.criticalAlerts || 0}</div>
                    </div>

                </div>

                <div className="bg-white border border-[#F3F4F6] shadow-sm rounded-2xl p-6 mt-2">
                    <h2 className="font-bold text-[18px] text-[#1F2937] mb-4">Flujo de Tráfico por Hora</h2>
                    <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                        <CartesianGrid vertical={false} stroke="#F3F4F6" />
                        <Tooltip />
                        <Area type="monotone" dataKey="vehicles" stroke="#FC6C03" fill="#FC6C03" fillOpacity={0.1} />
                        </AreaChart>
                    </ResponsiveContainer>
                    </div>
                </div>
                </section>

        {/* ─── BLOQUE 3: Reportes de Acceso ───────────── */}
        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="font-bold text-[32px] text-[#111827]">Reportes de Acceso</h2>
            <button className="flex items-center gap-2 border border-[#D1D5DB] rounded-lg px-4 py-2 bg-white text-sm">
              <span>Exportar CSV</span>
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm flex flex-col items-center justify-center">
              <span className="font-[800] text-[72px] text-[#1F2937]">{authPercentage}%</span>
              <span className="text-[14px] text-[#6B7280]">Tasa de autorización Real</span>
            </div>
            <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-[#F3F4F6] shadow-sm">
              <h2 className="font-bold text-[18px] text-[#1F2937] mb-4">Acceso por Categoría</h2>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.categoryData} barCategoryGap="20%">
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="auth" name="Autorizados" fill="#22C55E" radius={[4,4,0,0]} />
                    <Bar dataKey="denied" name="Denegados" fill="#EF4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-[#E5E7EB]" />

        {/* ─── BLOQUE NUEVO(4): Perfilamiento de Zonas ───────────── */}
        <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
            <h2 style={{ fontFamily: "'Fredoka One', cursive" }} className="text-[32px] text-[#111827]">
            Perfilamiento de Zonas
            </h2>
            <p className="text-[14px] text-[#6B7280]">
            Clasificación de vehículos detectados — inteligencia comercial por zona
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
            {/* Gráfica de tipos de vehículo */}
            <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6">
            <h3 className="font-bold text-[18px] text-[#1F2937] mb-4">Distribución por Tipo de Vehículo</h3>
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.categoryData} barCategoryGap="25%">
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                    <CartesianGrid vertical={false} stroke="#F3F4F6" />
                    <Tooltip />
                    <Bar dataKey="auth" name="Autorizados" fill="#FC6C03" radius={[4,4,0,0]} />
                    <Bar dataKey="denied" name="Denegados" fill="#253232" radius={[4,4,0,0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            {/* Insights comerciales automáticos */}
            <div className="flex flex-col gap-3">
            {(() => {
                const data = stats?.categoryData ?? [];
                const dominant = data.reduce((a, b) =>
                (a.auth + a.denied) > (b.auth + b.denied) ? a : b,
                { name: "", auth: 0, denied: 0 }
                );
                const total = data.reduce((s, d) => s + d.auth + d.denied, 0);
                const dominantPct = total > 0
                ? Math.round(((dominant.auth + dominant.denied) / total) * 100)
                : 0;

                const insights: Record<string, { icon: string; tip: string }> = {
                camion:      { icon: "🚛", tip: "Alto flujo de camiones. Zona ideal para estaciones de servicio con diesel o talleres de carga pesada." },
                bus:         { icon: "🚌", tip: "Flujo de buses detectado. Potencial para negocios de paso rápido: cafeterías, tiendas de conveniencia." },
                motocicleta: { icon: "🏍️", tip: "Zona de alto tráfico en moto. Oportunidad para lubricentros, repuestos o mensajería." },
                automovil:   { icon: "🚗", tip: "Predominan automóviles. Zona residencial o empresarial, ideal para parqueaderos o restaurantes." },
                otro:        { icon: "🚦", tip: "Tráfico mixto. Se recomienda análisis de horario pico para definir enfoque comercial." },
                };

                const insight = insights[dominant.name] ?? insights["otro"];

                return (
                <>
                    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5 border-l-4 border-l-[#FC6C03]">
                    <span className="text-[11px] font-semibold uppercase text-[#FC6C03] block mb-1">Tipo Dominante</span>
                    <span className="text-[22px]">{insight.icon}</span>
                    <span className="font-bold text-[16px] text-[#1F2937] ml-2 capitalize">{dominant.name || "—"}</span>
                    <p className="text-[12px] text-[#6B7280] mt-1">{dominantPct}% del total de detecciones</p>
                    </div>

                    <div className="bg-[#FFF7ED] rounded-2xl border border-[#FED7AA] p-5">
                    <span className="text-[11px] font-semibold uppercase text-[#FC6C03] block mb-2">💡 Insight Comercial</span>
                    <p className="text-[13px] text-[#92400E] leading-relaxed">{insight.tip}</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5">
                    <span className="text-[11px] font-semibold uppercase text-[#6B7280] block mb-3">Todos los tipos</span>
                    <div className="flex flex-col gap-2">
                        {data.map(d => {
                        const count = d.auth + d.denied;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                            <div key={d.name} className="flex items-center gap-2">
                            <span className="text-[12px] text-[#374151] capitalize w-24 truncate">{d.name}</span>
                            <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                                <div className="h-full bg-[#FC6C03] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-[#6B7280] w-8 text-right">{pct}%</span>
                            </div>
                        );
                        })}
                    </div>
                    </div>
                </>
                );
            })()}
            </div>
        </div>
        </section>

        <hr className="border-[#E5E7EB]" />

        {/* ─── BLOQUE 5: Mapa de Calor ────────────────────── */}
        <section className="flex flex-col gap-6">
          <h2 style={{ fontFamily: "'Fredoka One', cursive" }} className="text-[32px] text-[#111827]">Análisis de Horarios Pico</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
            <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-6 overflow-x-auto">
              <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, minmax(30px, 1fr))", gap: "4px", minWidth: "500px" }}>
                <div />
                {days.map(day => ( <div key={day} className="text-[12px] font-semibold text-center text-[#6B7280]">{day}</div> ))}
                {hours.map((hour, i) => (
                  <div key={hour} style={{ display: "contents" }}>
                    <div className="text-[13px] text-[#9CA3AF] text-right pr-3 flex items-center justify-end">{hour}</div>
                    {/* Pintamos las celdas extrayendo el color directo del backend */}
                    {stats?.heatmapData?.[i]?.map((val: number, j: number) => (
                      <div key={`${i}-${j}`} className="w-full rounded-sm aspect-square" style={{ backgroundColor: heatColors[val] || heatColors[0] }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-[#F3F4F6] shadow-sm p-5 flex flex-col gap-4">
                        <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-4 border-l-4 border-l-[#FC6C03]">
                            <span className="text-[11px] font-semibold uppercase text-[#FC6C03] block mb-1">Hora Pico Hoy</span>
                            <span className="text-[14px] font-bold text-[#1F2937]">
                            {/* Busca dinámicamente la hora con más vehículos */}
                            {stats?.trafficData?.reduce((max, curr) => curr.vehicles > max?.vehicles ? curr : max, { hour: "00h", vehicles: 0 }).hour} 
                            {' '} ({stats?.trafficData?.reduce((max, curr) => curr.vehicles > max?.vehicles ? curr : max, { hour: "00h", vehicles: 0 }).vehicles} veh)
                            </span>
                        </div>
                        <div className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl p-4 border-l-4 border-l-[#EF4444]">
                            <span className="text-[11px] font-semibold uppercase text-[#EF4444] block mb-1">Alerta de Servidor</span>
                            <span className="text-[14px] font-bold text-[#1F2937]">
                            {(stats?.inactiveCameras || 0) > 0 ? "Falla en cámaras" : "Operación Normal"}
                            </span>
                        </div>
                        </div>
                    </div>
                    </section>

      </div>
    </Layout>
  );
}
