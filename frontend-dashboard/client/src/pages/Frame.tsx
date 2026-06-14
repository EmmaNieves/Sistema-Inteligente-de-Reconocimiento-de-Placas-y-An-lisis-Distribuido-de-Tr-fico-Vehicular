import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const fields = [
  {
    id: "usuario",
    type: "text",
    placeholder: "Usuario",
  },
  {
    id: "contrasena",
    type: "password",
    placeholder: "Contraseña",
  },
];

export const Frame = (): JSX.Element => {
  return (
    <main className="min-h-screen w-full bg-[#253232] px-6 py-10 flex items-center justify-center">
      <div className="relative w-full max-w-[580px]">
        <img
          className="pointer-events-none absolute inset-x-[23px] top-[-20px] z-0 w-[calc(100%-46px)]"
          alt="Login card shadow"
          src="/figmaAssets/login-card-shadow-1.svg"
        />
        <Card className="relative z-10 mx-auto w-full max-w-[486px] rounded-[28px] border-0 bg-[#f8faed] shadow-none">
          <CardContent className="flex flex-col items-center px-[58px] pb-[76px] pt-[46px]">
            <img
              className="mb-[30px] h-auto w-[116px] rounded-3xl object-cover"
              alt="Login card shadow"
              src="/figmaAssets/login-card-shadow.png"
            />
            <header className="flex flex-col items-center text-center">
              <h1 className="[font-family:'Fredoka_One',Helvetica] text-black text-4xl font-normal tracking-[0] leading-[normal]">
                Dashboard LPR
              </h1>
              <p className="mt-3 [font-family:'Iosevka_Charon_Mono',Helvetica] text-[#3a4d4d] text-sm font-normal tracking-[0] leading-5">
                Introduce tus credenciales
              </p>
            </header>
            <form className="mt-[84px] flex w-full flex-col gap-6">
              <div className="flex flex-col gap-4">
                {fields.map((field) => (
                  <Input
                    key={field.id}
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    className="h-[50px] rounded-xl border-[#d7d9d1] bg-[#e8eae3] px-4 [font-family:'Iosevka_Charon_Mono',Helvetica] text-base font-normal tracking-[0] text-[#3a4d4d] placeholder:text-[#3a4d4d] focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="recordarme"
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Checkbox
                    id="recordarme"
                    className="h-4 w-4 rounded-[4px] border-[#3a4d4d] data-[state=checked]:bg-[#fc6c03] data-[state=checked]:border-[#fc6c03]"
                  />
                  <span className="[font-family:'Iosevka_Charon_Mono',Helvetica] text-sm font-normal tracking-[0] leading-5 text-[#3a4d4d]">
                    Recordarme
                  </span>
                </label>
                <button
                  type="button"
                  className="[font-family:'Iosevka_Charon_Mono',Helvetica] text-sm font-normal tracking-[0] leading-5 text-[#3a4d4d]"
                >
                  Recuperación de acceso
                </button>
              </div>
              <Button
                type="submit"
                className="h-auto rounded-xl bg-[#fc6c03] py-3.5 [font-family:'Fredoka_One',Helvetica] text-xl font-normal tracking-[0] text-[#f8faed] hover:bg-[#fc6c03]/95"
              >
                Iniciar Sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
