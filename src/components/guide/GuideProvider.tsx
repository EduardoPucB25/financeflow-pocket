import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { GUIDE_REGISTRY, guideKeyForPath, type GuideStep } from "@/lib/guide/registry";
import { useGuideProgress } from "@/lib/guide/useGuideProgress";
import { GuideOverlay } from "@/components/guide/GuideOverlay";
import { isNativeApp } from "@/lib/native/platform";

interface GuideContextValue {
  /** Whether the current route has a guide. */
  hasGuide: boolean;
  /** Replay the current route's guide (ignores seen-state). */
  openGuide: () => void;
}

const GuideContext = createContext<GuideContextValue>({
  hasGuide: false,
  openGuide: () => {},
});

export const useGuide = () => useContext(GuideContext);

type GuideState =
  | { status: "idle" }
  | { status: "active"; routeKey: string; steps: GuideStep[]; index: number };

/** True if the step has no target or its target exists in the DOM right now. */
function stepAvailable(step: GuideStep): boolean {
  return !step.target || document.querySelector(`[data-guide="${step.target}"]`) !== null;
}

/** Next available index in a direction; null when none remains. */
function seekIndex(steps: GuideStep[], from: number, dir: 1 | -1): number | null {
  for (let i = from; i >= 0 && i < steps.length; i += dir) {
    if (stepAvailable(steps[i])) return i;
  }
  return null;
}

export function GuideProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasSeen, markSeen } = useGuideProgress(userId);
  const [state, setState] = useState<GuideState>({ status: "idle" });

  const routeKey = guideKeyForPath(pathname);
  const hasGuide = routeKey !== null;

  const start = useCallback((key: string) => {
    const steps = GUIDE_REGISTRY[key];
    if (!steps?.length) return;
    const first = seekIndex(steps, 0, 1);
    if (first === null) return;
    setState({ status: "active", routeKey: key, steps, index: first });
  }, []);

  // Auto-start on first visit per route.
  useEffect(() => {
    if (!routeKey) return;
    if (hasSeen(routeKey)) return;
    // Delay lets suspense content paint before we measure targets.
    const t = setTimeout(() => start(routeKey), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Route change while a tour is open → close it (counts as seen).
  useEffect(() => {
    setState((s) => {
      if (s.status === "active" && guideKeyForPath(pathname) !== s.routeKey) {
        void markSeen(s.routeKey);
        return { status: "idle" };
      }
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const finish = useCallback(() => {
    setState((s) => {
      if (s.status === "active") void markSeen(s.routeKey);
      return { status: "idle" };
    });
  }, [markSeen]);

  const next = useCallback(() => {
    setState((s) => {
      if (s.status !== "active") return s;
      const ni = seekIndex(s.steps, s.index + 1, 1);
      if (ni === null) {
        void markSeen(s.routeKey);
        return { status: "idle" };
      }
      return { ...s, index: ni };
    });
  }, [markSeen]);

  const prev = useCallback(() => {
    setState((s) => {
      if (s.status !== "active") return s;
      const pi = seekIndex(s.steps, s.index - 1, -1);
      return pi === null ? s : { ...s, index: pi };
    });
  }, []);

  const openGuide = useCallback(() => {
    if (routeKey) start(routeKey);
  }, [routeKey, start]);

  const ctx = useMemo(() => ({ hasGuide, openGuide }), [hasGuide, openGuide]);

  const active = state.status === "active";
  const isLast =
    active && seekIndex(state.steps, state.index + 1, 1) === null;

  return (
    <GuideContext.Provider value={ctx}>
      {children}

      {/* Floating help button on native (web shells render their own buttons). */}
      {isNativeApp() && hasGuide && !active && (
        <button
          type="button"
          onClick={openGuide}
          aria-label="Guía de esta pantalla"
          className="fixed right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      )}

      {active && (
        <GuideOverlay
          steps={state.steps}
          index={state.index}
          onPrev={prev}
          onNext={next}
          onSkip={finish}
          isLast={isLast}
        />
      )}
    </GuideContext.Provider>
  );
}
