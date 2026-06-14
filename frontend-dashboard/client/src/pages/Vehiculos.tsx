import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, Vehicle, VehicleCreate } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, Loader2, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const VEHICLE_TYPES = ["automovil", "camioneta", "motocicleta", "camion", "bus", "otro"];

const emptyForm: VehicleCreate = { plate: "", owner: "", vehicle_type: "automovil", observations: "" };

export default function Vehiculos() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleCreate>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<Vehicle | null>(null);

  const { data, isLoading, error } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles", appliedSearch],
    queryFn: () => api.getVehicles(appliedSearch || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (d: VehicleCreate) => api.createVehicle(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehículo creado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VehicleCreate> }) => api.updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehículo actualizado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehículo eliminado" });
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ plate: v.plate, owner: v.owner, vehicle_type: v.vehicle_type, observations: v.observations || "" });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = () => {
    const data = { ...form, plate: form.plate.toUpperCase().trim() };
    if (!data.plate || !data.owner || !data.vehicle_type) {
      toast({ title: "Campos requeridos", description: "Placa, propietario y tipo son obligatorios.", variant: "destructive" });
      return;
    }
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Vehículos Autorizados
            </h1>
            <p className="text-sm text-gray-500">Gestión de vehículos registrados</p>
          </div>
          <Button onClick={openCreate} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-create-vehicle">
            <Plus size={16} className="mr-1" /> Agregar
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            data-testid="input-search-vehicles"
            placeholder="Buscar por placa o propietario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search)}
            className="rounded-xl border-gray-200 h-9 text-sm"
          />
          <Button size="sm" onClick={() => setAppliedSearch(search)} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-search-vehicles">
            <Search size={14} />
          </Button>
        </div>

        {/* Table */}
        <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : error ? (
              <p className="text-red-500 text-center py-12 text-sm">Error al cargar vehículos.</p>
            ) : !data?.length ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <Car size={40} className="text-gray-200" />
                <p className="text-sm">Sin vehículos registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Placa</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Propietario</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Observaciones</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Registrado</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors" data-testid={`row-vehicle-${v.id}`}>
                        <td className="px-4 py-3 font-mono font-semibold text-[#253232]">{v.plate}</td>
                        <td className="px-4 py-3 text-gray-700">{v.owner}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell capitalize">{v.vehicle_type}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell max-w-xs truncate">{v.observations || "—"}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {format(new Date(v.created_at), "dd MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(v)} className="h-7 w-7 text-gray-400 hover:text-[#fc6c03]" data-testid={`button-edit-vehicle-${v.id}`}>
                              <Pencil size={13} />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(v)} className="h-7 w-7 text-gray-400 hover:text-red-500" data-testid={`button-delete-vehicle-${v.id}`}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              {editing ? "Editar Vehículo" : "Nuevo Vehículo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-plate">Placa *</Label>
              <Input
                id="v-plate"
                data-testid="input-vehicle-plate"
                value={form.plate}
                onChange={(e) => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                placeholder="ABC123"
                className="rounded-xl font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-owner">Propietario *</Label>
              <Input
                id="v-owner"
                data-testid="input-vehicle-owner"
                value={form.owner}
                onChange={(e) => setForm(f => ({ ...f, owner: e.target.value }))}
                placeholder="Nombre del propietario"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Vehículo *</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm(f => ({ ...f, vehicle_type: v }))}>
                <SelectTrigger className="rounded-xl" data-testid="select-vehicle-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-obs">Observaciones</Label>
              <Textarea
                id="v-obs"
                data-testid="input-vehicle-observations"
                value={form.observations || ""}
                onChange={(e) => setForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Observaciones opcionales..."
                className="rounded-xl text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-save-vehicle">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#253232]">¿Eliminar vehículo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Esto eliminará el vehículo con placa <span className="font-mono font-bold">{deleteConfirm?.plate}</span>. Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
              data-testid="button-confirm-delete-vehicle"
            >
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
