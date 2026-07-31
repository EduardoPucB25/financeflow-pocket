import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/components/guide/GuideProvider";

/**
 * Help button for the web shells. `variant="sidebar"` renders a full-width row
 * (desktop sidebar footer); `variant="icon"` renders a compact icon button
 * (mobile-web top bar). Hidden when the current route has no guide.
 */
export function GuideHelpButton({ variant }: { variant: "sidebar" | "icon" }) {
  const { hasGuide, openGuide } = useGuide();
  if (!hasGuide) return null;

  if (variant === "sidebar") {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={openGuide}>
        <HelpCircle className="mr-2 h-4 w-4" /> Guía de esta pantalla
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={openGuide} aria-label="Guía de esta pantalla">
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
