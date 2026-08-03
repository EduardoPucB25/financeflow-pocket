import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Search, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { NotificationCapture, type InstalledApp } from "@/lib/native/notificationCapture";
import { KNOWN_APPS, appEmojiFor, appLabelFor, isKnownApp } from "@/lib/detection/apps";

/** Cuántas apps "otras" mostrar sin búsqueda (para no pintar cientos de filas). */
const UNSEARCHED_LIMIT = 24;

interface Row {
  packageName: string;
  label: string;
  known: boolean;
}

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
  const [query, setQuery] = useState("");
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

  const useInstalled = !!installed && installed.length > 0;

  const toggle = (pkg: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await setWatchedPackages([...selected]);
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

  // Universo de filas: apps instaladas (modo nativo) o catálogo (fallback),
  // más siempre las ya seleccionadas que no aparezcan en la fuente.
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const push = (packageName: string, label: string) => {
      if (!map.has(packageName)) {
        map.set(packageName, { packageName, label, known: isKnownApp(packageName) });
      }
    };
    if (useInstalled) {
      for (const a of installed!) push(a.packageName, a.label);
    } else {
      for (const a of KNOWN_APPS) push(a.pkg, a.label);
    }
    for (const pkg of selected) push(pkg, appLabelFor(pkg));
    return [...map.values()];
  }, [useInstalled, installed, selected]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = q
      ? rows.filter(
          (r) => r.label.toLowerCase().includes(q) || r.packageName.toLowerCase().includes(q),
        )
      : rows;
    return [...base].sort((a, b) => {
      const aScore = (selected.has(a.packageName) ? 0 : 2) + (a.known ? 0 : 1);
      const bScore = (selected.has(b.packageName) ? 0 : 2) + (b.known ? 0 : 1);
      if (aScore !== bScore) return aScore - bScore;
      return a.label.localeCompare(b.label);
    });
  }, [rows, q, selected]);

  const capped = !q && useInstalled && filtered.length > UNSEARCHED_LIMIT;
  const visible = capped ? filtered.slice(0, UNSEARCHED_LIMIT) : filtered;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Apps a vigilar</Label>
        <span className="text-xs text-muted-foreground">{selected.size} seleccionadas</span>
      </div>

      <p className="text-xs text-muted-foreground">
        {useInstalled
          ? "Toca las apps de banco o billetera que usas. Tomamos su nombre de paquete automáticamente; solo se leen notificaciones de estas apps."
          : "Elige entre las apps conocidas o agrega un paquete manual. Solo se leen notificaciones de estas apps."}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando apps instaladas…
        </div>
      ) : (
        <>
          {useInstalled && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar app…"
                className="pl-8"
              />
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
            {visible.map((r) => {
              const on = selected.has(r.packageName);
              return (
                <li key={r.packageName}>
                  <button
                    type="button"
                    onClick={() => toggle(r.packageName)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/20"
                  >
                    <span className="text-lg leading-none">{appEmojiFor(r.packageName)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {r.label}
                        {r.known && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/80">
                            banco
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground/70 font-mono">
                        {r.packageName}
                      </span>
                    </span>
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
            {visible.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">Sin coincidencias.</li>
            )}
          </ul>
          {capped && (
            <p className="text-[11px] text-muted-foreground">
              Mostrando {UNSEARCHED_LIMIT} de {filtered.length}. Usa la búsqueda para encontrar otras.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={customPkg}
              onChange={(e) => setCustomPkg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="Agregar paquete manual (com.mi.banco)"
              className="font-mono text-xs"
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustom}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar apps"}
          </Button>
        </>
      )}
    </div>
  );
}
