import { useEffect, useState } from "react";
import splashSvg from "@/assets/FinanceFlowPocket.svg?raw";
import { isNativeApp } from "@/lib/native/platform";
import { cn } from "@/lib/utils";

// Module scope: route remounts never replay the splash; a full reload = new launch.
let playedThisLaunch = false;

const SHOW_MS = 4600; // the SVG animation fully settles ~4.5s in
const FADE_MS = 400;

export function NativeSplash() {
  const [phase, setPhase] = useState<"hidden" | "shown" | "fading">("hidden");

  // Client-only gate: the server renders null, so SSR output is unaffected.
  useEffect(() => {
    if (playedThisLaunch || !isNativeApp()) return;
    playedThisLaunch = true;
    setPhase("shown");
  }, []);

  useEffect(() => {
    if (phase === "hidden") return;
    const t = setTimeout(
      () => setPhase(phase === "shown" ? "fading" : "hidden"),
      phase === "shown" ? SHOW_MS : FADE_MS,
    );
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      onClick={() => setPhase("fading")}
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0F172A]",
        "transition-opacity duration-[400ms]",
        phase === "fading" ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        className="w-48 max-w-[60vw] [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: splashSvg }}
      />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Finance Flow Pocket
      </p>
    </div>
  );
}
