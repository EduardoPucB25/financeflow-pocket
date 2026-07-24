import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  Inbox,
  Wallet,
  MoreHorizontal,
  CreditCard,
  Repeat,
  LineChart,
  Crown,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PastDueBanner } from "@/components/PastDueBanner";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/transactions", label: "Movimientos", icon: Receipt },
  { to: "/inbox", label: "Bandeja", icon: Inbox },
  { to: "/pockets", label: "Bolsillos", icon: Wallet },
] as const;

const MORE = [
  { to: "/debts", label: "Deudas", icon: CreditCard },
  { to: "/flows", label: "Flujos", icon: Repeat },
  { to: "/simulator", label: "Simulador", icon: LineChart },
  { to: "/upgrade", label: "Upgrade", icon: Crown },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

interface MobileShellProps {
  pendingCount: number;
  userEmail: string;
  isPro: boolean;
  isPastDue: boolean;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
}

export function MobileShell({
  pendingCount,
  userEmail,
  isPro,
  isPastDue,
  onSignOut,
  children,
}: MobileShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((m) => pathname.startsWith(m.to));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <PastDueBanner show={isPastDue} />
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16 grid-cols-5">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <t.icon className="h-5 w-5" />
                  {t.to === "/inbox" && pendingCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[9px] font-semibold leading-4 text-primary-foreground">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
        <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Más opciones</DrawerTitle>
          </DrawerHeader>
          <nav className="grid gap-1 px-4">
            {MORE.map((m) => (
              <Link
                key={m.to}
                to={m.to}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm",
                  pathname.startsWith(m.to)
                    ? "bg-accent/30 text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <m.icon className="h-5 w-5" /> {m.label}
              </Link>
            ))}
          </nav>
          <DrawerFooter>
            <div className="flex items-center gap-2">
              <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
              {isPro && (
                <Badge className="text-[10px] px-1.5 py-0 h-auto bg-primary/20 text-primary border-primary/30">
                  Pro
                </Badge>
              )}
            </div>
            <Button variant="ghost" className="justify-start" onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
