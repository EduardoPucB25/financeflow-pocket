import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, Search, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { NotificationCapture, type InstalledApp } from "@/lib/native/notificationCapture";
import {
  KNOWN_APPS,
  appEmojiFor,
  appLabelFor,
  isKnownApp,
  looksLikeMoneyApp,
} from "@/lib/detection/apps";

interface Row {
  packageName: string;
  label: string;
  known: boolean;
}

/**
 * Selector de apps vigiladas.
 *
 * Vista principal: solo las apps YA seleccionadas (chips con nombre).
 * "Agregar app" abre un diálogo que ofrece únicamente apps de banco o
 * billetera — nunca el listado completo del teléfono — mostrando el nombre;
 * el paquete queda como dato secundario y la captura manual en "Avanzado".
 */
export function AppPicker({
  supported,
  watchedPackages,
  setWatchedPackages,
}: {
  supported: boolean;
  watchedPackages: string[];
  setWatchedPackages: (pkgs: string[]) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(watchedPackages));
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);
  const [loading, setLoading] = useState(supported);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [customPkg, setCustomPkg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(watchedPackages));
  }, [watchedPackages]);

  useEffect(() => {
    let cancelled = false;
    if (!supported) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await NotificationCapture.getInstalledApps();
        if (!cancelled) setInstalled(Array.isArray(res?.apps) ? res.apps : null);
      } catch {
        if (!cancelled) setInstalled(null); // APK sin el método → fallback catálogo
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const toggle = (pkg: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });

  const persist = async (pkgs: string[]) => {
    setSaving(true);
    try {
      await setWatchedPackages(pkgs);
      toast.success("Apps vigiladas actualizadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const addCustom = () => {
    const pkg = customPkg.trim().toLowerCase();
    if (!pkg || !/^[a-z0-9_.]+$/.test(pkg)) {
      toast.error("Nombre de paquete inválido (ej. com.mi.banco)");
      return;
    }
    setSelected((prev) => new Set(prev).add(pkg));
    setCustomPkg("");
  };

  /** Solo apps de dinero: catálogo + instaladas que parecen banco/billetera. */
  const candidates = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const push = (packageName: string, label: string) => {
      if (!map.has(packageName)) {
        map.set(packageName, { packageName, label, known: isKnownApp(packageName) });
      }
    };
    if (installed?.length) {
      for (const a of installed) {
        if (looksLikeMoneyApp(a.packageName, a.label)) push(a.packageName, a.label);
      }
    }
    for (const a of KNOWN_APPS) push(a.pkg, a.label);
    for (const pkg of selected) push(pkg, appLabelFor(pkg));
    return [...map.values()];
  }, [installed, selected]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = q
      ? candidates.filter(
          (r) => r.label.toLowerCase().includes(q) || r.packageName.toLowerCase().includes(q),
        )
      : candidates;
    return [...base].sort((a, b) => {
      const score = (r: Row) => (selected.has(r.packageName) ? 0 : 2) + (r.known ? 0 : 1);
      const diff = score(a) - score(b);
      return diff !== 0 ? diff : a.label.localeCompare(b.label);
    });
  }, [candidates, q, selected]);

  const chips = [...selected];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Apps a vigilar</Label>
        <span className="text-xs text-muted-foreground">{chips.length} seleccionadas</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo se leen notificaciones de estas apps de banco o billetera.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando apps…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {chips.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aún no vigilas ninguna app. Agrega tu banco o billetera.
              </p>
            )}
            {chips.map((pkg) => (
              <span
                key={pkg}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-accent/20 pl-2.5 pr-1.5 py-1 text-sm"
              >
                <span aria-hidden>{appEmojiFor(pkg)}</span>
                <span className="max-w-[10rem] truncate">{appLabelFor(pkg)}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${appLabelFor(pkg)}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const next = chips.filter((p) => p !== pkg);
                    setSelected(new Set(next));
                    void persist(next);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>

          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar app
          </Button>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setQuery("");
            setSelected(new Set(watchedPackages));
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apps de banco y billetera</DialogTitle>
            <DialogDescription>
              Toca las apps que usas para tu dinero. No mostramos el resto de apps del teléfono.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar banco o billetera…"
              className="pl-8"
            />
          </div>

          <ul className="max-h-72 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
            {filtered.map((r) => {
              const on = selected.has(r.packageName);
              return (
                <li key={r.packageName}>
                  <button
                    type="button"
                    onClick={() => toggle(r.packageName)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/20"
                  >
                    <span className="text-lg leading-none">{appEmojiFor(r.packageName)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                    <span
                      className={
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border " +
                        (on ? "bg-primary border-primary text-primary-foreground" : "border-border")
                      }
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                Sin coincidencias. Usa “Avanzado” si tu banco no aparece.
              </li>
            )}
          </ul>

          {advanced ? (
            <div className="flex items-center gap-2">
              <Input
                value={customPkg}
                onChange={(e) => setCustomPkg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
                placeholder="com.mi.banco"
                className="font-mono text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCustom}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground underline self-start"
              onClick={() => setAdvanced(true)}
            >
              Avanzado: agregar por nombre de paquete
            </button>
          )}

          <DialogFooter>
            <Button
              type="button"
              disabled={saving}
              onClick={async () => {
                await persist([...selected]);
                setOpen(false);
              }}
            >
              {saving ? "Guardando…" : "Guardar apps"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
