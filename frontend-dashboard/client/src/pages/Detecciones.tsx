import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Plate, DetectionFilters } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Image as ImageIcon, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Detecciones() {
  const [filters, setFilters] = useState<DetectionFilters>({});
  const [applied, setApplied] = useState<DetectionFilters>({});
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Plate[]>({
    queryKey: ["/api/detections", applied],
    queryFn: () => api.getDetections(applied),
  });

  const applyFilters = () => setApplied({ ...filters });
  const clearFilters = () => { setFilters({}); setApplied({}); };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
            Detecciones
          </h1>
          <p className="text-sm text-gray-500">Registros de placas detectadas por el sistema</p>
        </div>

        {/* Filters */}
        <Card className="bg-white border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Filter size={14} /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input
                data-testid="input-filter-plate"
                placeholder="Buscar placa..."
                value={filters.plate || ""}
                onChange={(e) => setFilters(f => ({ ...f, plate: e.target.value }))}
                className="h-9 text-sm rounded-xl border-gray-200"
              />
              <Select
                value={filters.authorized === undefined ? "all" : String(filters.authorized)}
                onValueChange={(v) => setFilters(f => ({ ...f, authorized: v === "all" ? undefined : v === "true" }))}
              >
                <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200" data-testid="select-filter-authorized">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Autorizado</SelectItem>
                  <SelectItem value="false">No autorizado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                data-testid="input-filter-from"
                type="date"
                value={filters.from || ""}
                onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                className="h-9 text-sm rounded-xl border-gray-200"
              />
              <Input
                data-testid="input-filter-to"
                type="date"
                value={filters.to || ""}
                onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                className="h-9 text-sm rounded-xl border-gray-200"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={applyFilters} size="sm" className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-apply-filters">
                <Search size={14} className="mr-1" /> Buscar
              </Button>
              <Button onClick={clearFilters} size="sm" variant="outline" className="rounded-xl" data-testid="button-clear-filters">
                <X size={14} className="mr-1" /> Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {Array(6).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : error ? (
              <p className="text-red-500 text-center py-12 text-sm">Error al cargar detecciones. Verifica la conexión con el backend.</p>
            ) : !data?.length ? (
              <p className="text-gray-400 text-center py-12 text-sm">Sin detecciones registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Placa</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">YOLO</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">OCR</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Imagen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors" data-testid={`row-detection-${d.id}`}>
                        <td className="px-4 py-3 font-mono font-semibold text-[#253232]">{d.plate_text}</td>
                        <td className="px-4 py-3">
                          <Badge className={d.authorized ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                            {d.authorized ? "Autorizado" : "No autorizado"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{d.vehicle_type || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                          {d.yolo_confidence != null ? `${(d.yolo_confidence * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                          {d.ocr_confidence != null ? `${(d.ocr_confidence * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                          {format(new Date(d.detection_timestamp), "dd MMM yyyy HH:mm", { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          {d.image_url ? (
                            <button
                              onClick={() => setPreviewImg(d.image_url!)}
                              className="text-[#fc6c03] hover:text-[#e05f00]"
                              data-testid={`button-image-${d.id}`}
                            >
                              <ImageIcon size={16} />
                            </button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <X size={24} />
            </button>
            <img src={previewImg} alt="Detección" className="w-full rounded-xl" />
          </div>
        </div>
      )}
    </Layout>
  );
}
