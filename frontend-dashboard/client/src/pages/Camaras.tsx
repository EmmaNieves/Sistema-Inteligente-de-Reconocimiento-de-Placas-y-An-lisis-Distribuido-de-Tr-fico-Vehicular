import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, Camera, CameraCreate } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Camera as CameraIcon, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const emptyForm: CameraCreate = { camera_code: "", name: "", location: "", status: "activo", active: true };

export default function Camaras() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Camera | null>(null);
  const [form, setForm] = useState<CameraCreate>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<Camera | null>(null);

  const { data, isLoading, error } = useQuery<Camera[]>({
    queryKey: ["/api/cameras"],
    queryFn: () => api.getCameras(),
  });

  const createMutation = useMutation({
    mutationFn: (d: CameraCreate) => api.createCamera(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cameras"] }); toast({ title: "Cámara creada" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CameraCreate> }) => api.updateCamera(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cameras"] }); toast({ title: "Cámara actualizada" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCamera(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cameras"] }); toast({ title: "Cámara eliminada" }); setDeleteConfirm(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Camera) => {
    setEditing(c);
    setForm({ camera_code: c.camera_code, name: c.name, location: c.location, status: c.status, active: c.active });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.camera_code || !form.name || !form.location) {
      toast({ title: "Campos requeridos", description: "Código, nombre y ubicación son obligatorios.", variant: "destructive" });
      return;
    }
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Cámaras
            </h1>
            <p className="text-sm text-gray-500">Estado y gestión de cámaras de vigilancia</p>
          </div>
          <Button onClick={openCreate} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-create-camera">
            <Plus size={16} className="mr-1" /> Agregar
          </Button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(4).fill(0).map((_, i) => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : error ? (
          <p className="text-red-500 text-center py-12 text-sm">Error al cargar cámaras.</p>
        ) : !data?.length ? (
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardContent className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <CameraIcon size={40} className="text-gray-200" />
              <p className="text-sm">Sin cámaras registradas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((c) => (
              <Card key={c.id} className="bg-white border-0 shadow-sm rounded-2xl" data-testid={`card-camera-${c.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.active ? "bg-green-50" : "bg-gray-100"}`}>
                        {c.active
                          ? <Wifi size={18} className="text-green-600" />
                          : <WifiOff size={18} className="text-gray-400" />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-[#253232] text-sm">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.camera_code}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} className="h-7 w-7 text-gray-400 hover:text-[#fc6c03]" data-testid={`button-edit-camera-${c.id}`}>
                        <Pencil size={12} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(c)} className="h-7 w-7 text-gray-400 hover:text-red-500" data-testid={`button-delete-camera-${c.id}`}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-500">
                    <p><span className="text-gray-400">Ubicación:</span> {c.location}</p>
                    <p><span className="text-gray-400">Estado:</span>{" "}
                      <span className={`font-medium ${c.status === "activo" ? "text-green-600" : "text-red-500"}`}>{c.status}</span>
                    </p>
                    <p><span className="text-gray-400">Última conexión:</span>{" "}
                      {c.last_connection
                        ? format(new Date(c.last_connection), "dd MMM yyyy HH:mm", { locale: es })
                        : "—"}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${c.active ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className={`text-xs font-medium ${c.active ? "text-green-600" : "text-gray-400"}`}>
                      {c.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              {editing ? "Editar Cámara" : "Nueva Cámara"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-code">Código *</Label>
              <Input id="c-code" data-testid="input-camera-code" value={form.camera_code}
                onChange={(e) => setForm(f => ({ ...f, camera_code: e.target.value }))}
                placeholder="CAM-001" className="rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nombre *</Label>
              <Input id="c-name" data-testid="input-camera-name" value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Cámara entrada principal" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-loc">Ubicación *</Label>
              <Input id="c-loc" data-testid="input-camera-location" value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="Entrada norte" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v: "activo" | "inactivo") => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl" data-testid="select-camera-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Activa</Label>
              <Switch
                data-testid="switch-camera-active"
                checked={form.active}
                onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-save-camera">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar cámara?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Esto eliminará la cámara <span className="font-bold">{deleteConfirm?.name}</span>.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600 text-white rounded-xl" data-testid="button-confirm-delete-camera">
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
