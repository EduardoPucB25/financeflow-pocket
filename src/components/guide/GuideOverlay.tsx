import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GuideStep } from "@/lib/guide/registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuideOverlayProps {
  steps: GuideStep[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function GuideOverlay({ steps, index, onPrev, onNext, onSkip, isLast }: GuideOverlayProps) {
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Measure (and re-measure on scroll/resize) the current step's target.
  useEffect(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-guide="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });

    let raf = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    };
    // First measure after the smooth scroll has a moment to settle.
    const t = setTimeout(measure, reducedMotion ? 0 : 320);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, { capture: true });
    };
  }, [step, reducedMotion]);

  // Esc to skip; focus the card on step change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    cardRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onSkip]);

  if (!step) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const placeBelow = rect !== null && rect.top + rect.height / 2 < window.innerHeight / 2;

  const cardStyle: React.CSSProperties = isMobile
    ? { left: 12, right: 12, bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }
    : rect
      ? placeBelow
        ? {
            top: Math.min(rect.top + rect.height + 12, window.innerHeight - 220),
            left: Math.max(16, Math.min(rect.left, window.innerWidth - 400)),
          }
        : {
            bottom: Math.max(16, window.innerHeight - rect.top + 12),
            left: Math.max(16, Math.min(rect.left, window.innerWidth - 400)),
          }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Spotlight (cutout) or full dim for target-less steps */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary/60"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
            transition: reducedMotion ? "none" : "top .25s ease, left .25s ease, width .25s ease, height .25s ease",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/60" />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl outline-none"
        style={cardStyle}
      >
        <p className="font-semibold">{step.title}</p>
        <p className="mt-1.5 text-sm text-muted-foreground" aria-live="polite">
          {step.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  i === index ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={onPrev}>
                Anterior
              </Button>
            )}
            {!isLast && (
              <Button size="sm" variant="ghost" onClick={onSkip}>
                Saltar
              </Button>
            )}
            <Button size="sm" onClick={onNext}>
              {isLast ? "Listo" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
