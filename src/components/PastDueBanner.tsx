import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function PastDueBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 text-sm text-amber-200 flex items-center gap-2 justify-center">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Tu último pago falló. Mantienes tu acceso Pro mientras reintentamos el cobro.{" "}
        <Link to="/upgrade" className="underline font-medium">
          Actualizar método de pago
        </Link>
      </span>
    </div>
  );
}

export function HiddenByPlanNotice({
  hiddenCount,
  entity,
}: {
  hiddenCount: number;
  entity: string;
}) {
  if (hiddenCount <= 0) return null;
  return (
    <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
      <span>
        Tienes <strong>{hiddenCount}</strong> {entity} adicionales ocultos por tu plan Free.
        Vuelven a ser visibles al reactivar Pro.
      </span>
      <Link
        to="/upgrade"
        className="text-primary underline font-medium shrink-0"
      >
        Ver Pro
      </Link>
    </div>
  );
}
