import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { seedDefaultPockets, detectedTransactionsQuery } from "@/lib/queries";
import { useNotificationCapture } from "@/hooks/useNotificationCapture";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Receipt,
  Repeat,
  LineChart,
  Settings,
  LogOut,
  Menu,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/pockets", label: "Bolsillos", icon: Wallet },
  { to: "/debts", label: "Deudas", icon: CreditCard },
  { to: "/transactions", label: "Movimientos", icon: Receipt },
  { to: "/inbox", label: "Bandeja", icon: Inbox },
  { to: "/flows", label: "Flujos", icon: Repeat },
  { to: "/simulator", label: "Simulador", icon: LineChart },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    seedDefaultPockets(user.id).catch(console.error);
  }, [user.id]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">F</span>
          Finance Flow Pocket
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground truncate mb-2">{user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">F</span>
          Finance Flow Pocket
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen((v) => !v)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-card">
          <nav className="p-2 grid grid-cols-3 gap-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs",
                    active ? "bg-accent/30 text-foreground" : "text-muted-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate pr-2">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
