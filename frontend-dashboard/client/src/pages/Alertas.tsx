import { useQuery, useMutation } from "@tanstack/react-query";
import { api, Alerta } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const estadoBadge = (estado: string) => {
  if (estado === "enviado") return "bg-green-100 text-green-700";
  if (estado === "fallido") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
};

export default function Alertas() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<Alerta[]>({
    queryKey: ["/api/alertas"],
    queryFn: () => api.getAlertas(),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => api.resolveAlerta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alertas"] });
      toast({ title: "Alerta resuelta", description: "La alerta fue marcada como resuelta." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo resolver la alerta.", variant: "destructive" });
    },
  });

  const pending = data?.filter(a => !a.resolved) ?? [];
  const resolved = data?.filter(a => a.resolved) ?? [];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Alertas
            </h1>
            <p className="text-sm text-gray-500">Gestión de alertas del sistema</p>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full font-medium" data-testid="text-pending-count">
              {pending.length} pendientes
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium" data-testid="text-resolved-count">
              {resolved.length} resueltas
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : error ? (
          <p className="text-red-500 text-center py-12 text-sm">Error al cargar alertas. Verifica la conexión con el backend.</p>
        ) : !data?.length ? (
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 text-center text-gray-400 text-sm">Sin alertas registradas</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {[...pending, ...resolved].map((a) => (
              <Card
                key={a.id}
                className={`border-0 shadow-sm rounded-2xl transition-all ${a.resolved ? "bg-gray-50 opacity-70" : "bg-white"}`}
                data-testid={`card-alert-${a.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.resolved ? "bg-gray-100" : "bg-orange-50"}`}>
                      {a.resolved
                        ? <CheckCircle2 size={18} className="text-gray-400" />
                        : <AlertTriangle size={18} className="text-[#fc6c03]" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-[#253232] font-mono text-sm" data-testid={`text-alert-plate-${a.id}`}>
                        {a.plate_text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {format(new Date(a.fecha), "dd MMM yyyy HH:mm", { locale: es })}
                        </span>
                        <Badge className={`text-xs ${estadoBadge(a.estado_envio)} hover:${estadoBadge(a.estado_envio)}`}>
                          {a.estado_envio}
                        </Badge>
                        {a.resolved && (
                          <Badge className="text-xs bg-gray-100 text-gray-500 hover:bg-gray-100">resuelta</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {!a.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate(a.id)}
                      disabled={resolveMutation.isPending}
                      className="rounded-xl border-[#fc6c03] text-[#fc6c03] hover:bg-[#fc6c03] hover:text-white flex-shrink-0"
                      data-testid={`button-resolve-${a.id}`}
                    >
                      {resolveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="mr-1" />}
                      Resolver
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
