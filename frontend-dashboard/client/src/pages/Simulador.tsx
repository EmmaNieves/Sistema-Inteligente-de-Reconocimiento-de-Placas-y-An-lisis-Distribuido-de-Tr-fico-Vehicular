import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, SimulationCreate, SimulationResult, Simulation } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, PlayCircle, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const VEHICLE_TYPES = ["automovil", "camioneta", "motocicleta", "camion", "bus", "otro"];
const emptyForm: SimulationCreate = { camera_code: "", city: "", plate_text: "", vehicle_type: "automovil" };

export default function Simulador() {
  const { toast } = useToast();
  const [form, setForm] = useState<SimulationCreate>(emptyForm);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const { data: history } = useQuery<Simulation[]>({
    queryKey: ["/api/simulations"],
    queryFn: () => api.getSimulations(),
  });

  const simulateMutation = useMutation({
    mutationFn: (data: SimulationCreate) => api.simulate(data),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/simulations"] });
    },
    onError: (e: any) => toast({ title: "Error en simulación", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.camera_code || !form.city || !form.plate_text || !form.vehicle_type) {
      toast({ title: "Campos requeridos", description: "Completa todos los campos.", variant: "destructive" });
      return;
    }
    setResult(null);
    simulateMutation.mutate({ ...form, plate_text: form.plate_text.toUpperCase().trim() });
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
            Simulador
          </h1>
          <p className="text-sm text-gray-500">Simula una detección de placa vehicular</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[#253232] flex items-center gap-2">
                <PlayCircle size={16} className="text-[#fc6c03]" /> Nueva Simulación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-camera">Código de Cámara</Label>
                  <Input id="s-camera" data-testid="input-sim-camera"
                    value={form.camera_code}
                    onChange={(e) => setForm(f => ({ ...f, camera_code: e.target.value }))}
                    placeholder="CAM-001" className="rounded-xl font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-city">Ciudad</Label>
                  <Input id="s-city" data-testid="input-sim-city"
                    value={form.city}
                    onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Bogotá" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-plate">Placa</Label>
                  <Input id="s-plate" data-testid="input-sim-plate"
                    value={form.plate_text}
                    onChange={(e) => setForm(f => ({ ...f, plate_text: e.target.value.toUpperCase() }))}
                    placeholder="ABC123" className="rounded-xl font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Vehículo</Label>
                  <Select value={form.vehicle_type} onValueChange={(v) => setForm(f => ({ ...f, vehicle_type: v }))}>
                    <SelectTrigger className="rounded-xl" data-testid="select-sim-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={simulateMutation.isPending}
                  className="w-full bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-simulate">
                  {simulateMutation.isPending
                    ? <><Loader2 size={16} className="animate-spin mr-2" /> Simulando...</>
                    : <><PlayCircle size={16} className="mr-2" /> Simular Detección</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result */}
          <div className="space-y-4">
            {result && (
              <Card className={`border-0 shadow-sm rounded-2xl ${result.authorized ? "bg-green-50" : "bg-red-50"}`} data-testid="card-simulation-result">
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.authorized ? "bg-green-100" : "bg-red-100"}`}>
                    {result.authorized
                      ? <CheckCircle2 size={32} className="text-green-600" />
                      : <XCircle size={32} className="text-red-600" />
                    }
                  </div>
                  <p className="text-3xl font-bold font-mono text-[#253232] mb-2" data-testid="text-sim-plate">{result.plate_text}</p>
                  <p className={`text-lg font-semibold ${result.authorized ? "text-green-700" : "text-red-700"}`} data-testid="text-sim-status">
                    {result.authorized ? "Vehículo Autorizado" : "Vehículo No Autorizado"}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Simulación #{result.simulation?.id} guardada
                  </p>
                </CardContent>
              </Card>
            )}

            {/* History */}
            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <Clock size={14} /> Historial de Simulaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!history?.length ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin historial</p>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                    {history.slice().reverse().map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-2.5" data-testid={`row-sim-${s.id}`}>
                        <div>
                          <p className="text-sm font-mono font-semibold text-[#253232]">{s.plate_text}</p>
                          <p className="text-xs text-gray-400">{s.city} · {s.camera_code}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.authorized ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {s.authorized ? "Autorizado" : "No autorizado"}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {format(new Date(s.simulation_timestamp), "dd MMM HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
