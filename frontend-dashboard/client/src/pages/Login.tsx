import { useState, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { AuthContext } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export default function Login() {
  const { login, user, loading } = useContext(AuthContext);
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Por favor ingresa usuario y contraseña.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "Credenciales incorrectas.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#253232] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#fc6c03] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#253232] px-6 py-10 flex items-center justify-center">
      <div className="relative w-full max-w-[580px]">
        <img
          className="pointer-events-none absolute inset-x-[23px] top-[-20px] z-0 w-[calc(100%-46px)]"
          alt=""
          src="/figmaAssets/login-card-shadow-1.svg"
        />
        <Card className="relative z-10 mx-auto w-full max-w-[486px] rounded-[28px] border-0 bg-[#f8faed] shadow-none">
          <CardContent className="flex flex-col items-center px-[58px] pb-[76px] pt-[46px]">
            <img
              className="mb-[30px] h-auto w-[116px] rounded-3xl object-cover"
              alt="Dashboard LPR"
              src="/figmaAssets/login-card-shadow.png"
            />
            <header className="flex flex-col items-center text-center">
              <h1
                className="text-black text-4xl font-normal"
                style={{ fontFamily: "'Fredoka One', Helvetica" }}
              >
                Dashboard LPR
              </h1>
              <p
                className="mt-3 text-[#3a4d4d] text-sm leading-5"
                style={{ fontFamily: "monospace" }}
              >
                Introduce tus credenciales
              </p>
            </header>

            <form onSubmit={handleSubmit} className="mt-[84px] flex w-full flex-col gap-6">
              <div className="flex flex-col gap-4">
                <Input
                  data-testid="input-username"
                  type="text"
                  placeholder="Usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="h-[50px] rounded-xl border-[#d7d9d1] bg-[#e8eae3] px-4 text-base text-[#3a4d4d] placeholder:text-[#3a4d4d] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Input
                  data-testid="input-password"
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-[50px] rounded-xl border-[#d7d9d1] bg-[#e8eae3] px-4 text-base text-[#3a4d4d] placeholder:text-[#3a4d4d] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              {error && (
                <div
                  data-testid="text-login-error"
                  className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <label htmlFor="recordarme" className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id="recordarme"
                    data-testid="checkbox-remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(!!v)}
                    className="h-4 w-4 rounded-[4px] border-[#3a4d4d] data-[state=checked]:bg-[#fc6c03] data-[state=checked]:border-[#fc6c03]"
                  />
                  <span className="text-sm leading-5 text-[#3a4d4d]" style={{ fontFamily: "monospace" }}>
                    Recordarme
                  </span>
                </label>
                <button type="button" className="text-sm leading-5 text-[#3a4d4d] hover:underline" style={{ fontFamily: "monospace" }}>
                  Recuperación de acceso
                </button>
              </div>

              <Button
                type="submit"
                data-testid="button-login"
                disabled={submitting}
                className="h-auto rounded-xl bg-[#fc6c03] py-3.5 text-xl font-normal text-[#f8faed] hover:bg-[#e05f00] disabled:opacity-60"
                style={{ fontFamily: "'Fredoka One', Helvetica" }}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : "Iniciar Sesión"}
              </Button>

              {/* Demo credentials hint */}
              <div className="bg-[#e8eae3] rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-[#3a4d4d]" style={{ fontFamily: "monospace" }}>
                  <span className="font-bold">Usuario:</span> admin
                </p>
                <p className="text-xs text-[#3a4d4d] mt-0.5" style={{ fontFamily: "monospace" }}>
                  <span className="font-bold">Contraseña:</span> Admin123!
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
