import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/native/platform";
import { Download, RefreshCw } from "lucide-react";

interface InstalledVersion {
  versionName: string;
  versionCode: number;
}

interface VersionManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

export function UpdateCard() {
  if (!isNativeApp()) return null;
  return <UpdateCardInner />;
}

function UpdateCardInner() {
  const [installed, setInstalled] = useState<InstalledVersion | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (mounted) {
          setInstalled({ versionName: info.version, versionCode: Number(info.build) || 1 });
        }
      } catch {
        // Binaries that predate @capacitor/app are, by construction, v1.
        if (mounted) setInstalled({ versionName: "1.0", versionCode: 1 });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const manifest = useQuery({
    queryKey: ["app-version"],
    queryFn: async (): Promise<VersionManifest> => {
      const r = await fetch("/app-version.json", { cache: "no-store" });
      if (!r.ok) throw new Error("manifest");
      return r.json();
    },
    retry: 1,
    staleTime: 5 * 60_000,
  });

  const hasUpdate =
    installed !== null && manifest.data !== undefined && manifest.data.versionCode > installed.versionCode;

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Actualizaciones de la app</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Versión instalada:{" "}
        <span className="font-medium text-foreground">
          {installed ? `${installed.versionName} (${installed.versionCode})` : "detectando…"}
        </span>
      </p>

      {manifest.isError && (
        <p className="text-xs text-muted-foreground">
          No se pudo comprobar si hay actualizaciones. Revisa tu conexión.
        </p>
      )}

      {manifest.data && installed && !hasUpdate && (
        <p className="text-sm text-primary">Tienes la última versión.</p>
      )}

      {hasUpdate && manifest.data && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Nueva versión disponible: {manifest.data.versionName}</p>
          {manifest.data.notes && (
            <p className="text-xs text-muted-foreground">{manifest.data.notes}</p>
          )}
          <Button
            onClick={() =>
              window.open(new URL(manifest.data.apkUrl, window.location.origin).toString(), "_blank")
            }
          >
            <Download className="mr-2 h-4 w-4" /> Descargar actualización
          </Button>
          <p className="text-xs text-muted-foreground">
            Se abrirá tu navegador para descargar el APK. Cuando termine, ábrelo y toca Actualizar.
            Tus datos y tu sesión se conservan.
          </p>
        </div>
      )}
    </Card>
  );
}
