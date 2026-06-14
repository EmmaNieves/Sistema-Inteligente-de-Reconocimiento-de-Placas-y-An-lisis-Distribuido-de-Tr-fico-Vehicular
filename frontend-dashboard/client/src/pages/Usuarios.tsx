import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, User, UserCreate } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Users as UsersIcon, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";

const emptyForm: UserCreate = { username: "", email: "", password: "", role: "operador", status: "activo" };

export default function Usuarios() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserCreate>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

  const { data, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (d: UserCreate) => api.createUser(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Usuario creado" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserCreate> }) => api.updateUser(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Usuario actualizado" }); closeDialog(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Usuario eliminado" }); setDeleteConfirm(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ username: u.username, email: u.email, password: "", role: u.role, status: u.status });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.username || !form.email || (!editing && !form.password)) {
      toast({ title: "Campos requeridos", description: "Usuario, email y contraseña son obligatorios.", variant: "destructive" });
      return;
    }
    if (editing) {
      const data: Partial<UserCreate> = { role: form.role, status: form.status };
      if (form.password) data.password = form.password;
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              Usuarios
            </h1>
            <p className="text-sm text-gray-500">Gestión de usuarios del sistema</p>
          </div>
          <Button onClick={openCreate} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-create-user">
            <Plus size={16} className="mr-1" /> Agregar
          </Button>
        </div>

        <Card className="bg-white border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : error ? (
              <p className="text-red-500 text-center py-12 text-sm">Error al cargar usuarios.</p>
            ) : !data?.length ? (
              <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
                <UsersIcon size={40} className="text-gray-200" />
                <p className="text-sm">Sin usuarios registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Creado</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors" data-testid={`row-user-${u.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#253232] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {u.username[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-[#253232]">{u.username}</span>
                            {u.id === currentUser?.id && (
                              <span className="text-xs text-[#fc6c03] font-medium">(tú)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge className={u.role === "administrador" ? "bg-[#fc6c03]/10 text-[#fc6c03] hover:bg-[#fc6c03]/10" : "bg-gray-100 text-gray-600 hover:bg-gray-100"}>
                            <Shield size={10} className="mr-1" />
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={u.status === "activo" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                            {u.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                          {format(new Date(u.created_at), "dd MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(u)} className="h-7 w-7 text-gray-400 hover:text-[#fc6c03]" data-testid={`button-edit-user-${u.id}`}>
                              <Pencil size={13} />
                            </Button>
                            {u.id !== currentUser?.id && (
                              <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm(u)} className="h-7 w-7 text-gray-400 hover:text-red-500" data-testid={`button-delete-user-${u.id}`}>
                                <Trash2 size={13} />
                              </Button>
                            )}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#253232]" style={{ fontFamily: "'Fredoka One', Helvetica" }}>
              {editing ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Usuario *</Label>
              <Input id="u-username" data-testid="input-user-username" value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                disabled={!!editing} placeholder="nombre_usuario" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email *</Label>
              <Input id="u-email" data-testid="input-user-email" type="email" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={!!editing} placeholder="correo@ejemplo.com" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">{editing ? "Nueva Contraseña (opcional)" : "Contraseña *"}</Label>
              <Input id="u-password" data-testid="input-user-password" type="password" value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "Dejar vacío para no cambiar" : "Contraseña"} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v: "administrador" | "operador") => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="rounded-xl" data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v: "activo" | "inactivo") => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl" data-testid="select-user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="bg-[#fc6c03] hover:bg-[#e05f00] text-white rounded-xl" data-testid="button-save-user">
              {isPending ? <Loader2 size={16} className="animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar usuario?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Esto eliminará a <span className="font-bold">{deleteConfirm?.username}</span> permanentemente.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600 text-white rounded-xl" data-testid="button-confirm-delete-user">
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
