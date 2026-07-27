import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQuery, pocketsQuery, debtsQuery, flowsQuery, transactionsQuery, subscriptionQuery } from "@/lib/queries";
import { deriveSubStatus } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { money, pct } from "@/lib/format";
import {
  compoundDaily,
  accruedYield,
  nextCutoffAndDue,
  formatDateEs,
  daysUntilPayday,
  periodSpend,
  limitStatus,
  YIELD_DISCLAIMER,
  type SpendTx,
} from "@/lib/finance";
import { netWorth, isAccessible, type PocketLike, type DebtLike } from "@/lib/netWorth";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useMemo } from "react";
import { TrendingUp, CreditCard, Wallet, Calendar, Receipt, Crown, Zap, PiggyBank, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — Finance Flow Pocket" },
      { name: "description", content: "Vista general de tus finanzas: patrimonio, bolsillos, deudas, transacciones y rendimiento." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(profileQuery());
    context.queryClient.ensureQueryData(pocketsQuery());
    context.queryClient.ensureQueryData(debtsQuery());
    context.queryClient.ensureQueryData(flowsQuery());
    context.queryClient.ensureQueryData(transactionsQuery());
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const { data: pocketsData } = useSuspenseQuery(pocketsQuery());
  const { data: debtsData } = useSuspenseQuery(debtsQuery());
  const { data: flows } = useSuspenseQuery(flowsQuery());
  const { data: transactions } = useSuspenseQuery(transactionsQuery());
  const { data: subscription } = useQuery(subscriptionQuery(profile?.id));
  const { isPro } = deriveSubStatus(subscription);
  const qc = useQueryClient();

  const pockets = pocketsData as unknown as (PocketLike & { target_percentage: number })[];
  const debts = debtsData as unknown as DebtLike[];
  const spendTxs = transactions as unknown as SpendTx[];

  const totalBalance = pockets.reduce((s, p) => s + Number(p.current_balance), 0);
  const totalPct = pockets.reduce((s, p) => s + Number(p.target_percentage), 0);
  const annualRate = Number(profile?.annual_yield_rate ?? 15);
  const cards = debts.filter((d) => d.debt_type === "card");
  const nw = netWorth(pockets, debts);
  const invisibleCash = cards.reduce(
    (s, c) => s + Math.max(0, Number(c.credit_limit ?? 0) - Number(c.current_balance)),
    0,
  );
  const salary = Number(profile?.biweekly_salary ?? 0);
  const paydayIn = daysUntilPayday([15, 30]);
  const recentTx = transactions.slice(0, 5);

  const yieldPockets = pockets.filter((p) => p.earns_yield);
  const yieldBase = yieldPockets.reduce((s, p) => s + Number(p.yield_base_balance ?? p.current_balance), 0);
  const accruedTotal = yieldPockets.reduce((s, p) => {
    const a = accruedYield(
      Number(p.yield_base_balance ?? p.current_balance),
      Number(p.yield_rate ?? annualRate),
      p.yield_start_date,
    );
    return s + a.current;
  }, 0);
  const earnedTotal = accruedTotal - yieldBase;

  const projectionData = useMemo(
    () =>
      [30, 60, 90, 180, 365].map((d) => ({
        day: `${d}d`,
        balance: Math.round(
          yieldPockets.reduce(
            (s, p) =>
              s +
              compoundDaily(
                Number(p.yield_base_balance ?? p.current_balance),
                Number(p.yield_rate ?? annualRate),
                d,
              ),
            0,
          ),
        ),
      })),
    [yieldPockets, annualRate],
  );

  const globalLimit = Number(profile?.global_spend_limit_monthly ?? 0);
  const globalSpent = useMemo(() => periodSpend(spendTxs, "monthly"), [spendTxs]);
  const globalStatus = limitStatus("monthly", globalLimit, globalSpent);

  const toggleYield = useMutation({
    mutationFn: async ({ id, on, balance }: { id: string; on: boolean; balance: number }) => {
      const { error } = await supabase
        .from("pockets")
        .update({
          earns_yield: on,
          yield_start_date: on ? new Date().toISOString().slice(0, 10) : null,
          yield_base_balance: on ? balance : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pockets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const upcomingFlows = flows.filter((f) => f.next_execution_date).slice(0, 5);

  return (
    


      


        

Hola{profile?.full_name ? `, ${profile.full_name}` : ""}


        

Tu panorama financiero de hoy


      



      {/* Hero stats */}
      


        
        = 0 ? "text-primary" : "text-destructive"}
        />
        
        
      



      {globalLimit > 0 && globalStatus.level !== "ok" && (
        


          
          


            


              {globalStatus.level === "over"
                ? "Superaste tu límite de gasto mensual"
                : "Estás cerca de tu límite de gasto mensual"}
            


            


              Llevas {money(globalStatus.spent)} de {money(globalStatus.limit)} ({Math.round(globalStatus.ratio * 100)}%).
            


          


        


      )}

      {!isPro && (
        


          


            


              
            


            


              

Desbloquea funciones Pro


              


                Bolsillos ilimitados, detección automática de notificaciones bancarias y simulador avanzado.
              


            


          


          
            
               Ver planes Pro
            
          
        


      )}

      


        {/* Allocation */}
        
          


            


              

Distribución por bolsillos


              


                Total {pct(totalPct)} asignado {totalPct !== 100 && "· ajusta a 100%"}
              


            


            Gestionar
          


          {pockets.length === 0 ? (
            

Cargando bolsillos por defecto…


          ) : (
            


              


                
                  
                    
                      {pockets.map((p) => (
                        
                      ))}
                    
                     `${v}%`}
                    />
                  
                
              


              


                {pockets.map((p) => (
                  


                    


                      


                        
                        {p.name}
                        {!isAccessible(p) && (
                          
                            no disponible
                          
                        )}
                      


                      
                        {money(p.current_balance as number)} · {money((salary * Number(p.target_percentage)) / 100)}/qna
                      
                    


                  


                ))}
              


            


          )}
        

        {/* Yield projection with pocket selector */}
        
          


            

Rendimiento compuesto


            


              Solo los bolsillos seleccionados · valor actual {money(accruedTotal)}
            


          


          


            
              
                
                 `$${(v / 1000).toFixed(0)}k`} />
                 money(v)}
                />
                
              
            
          


          


            

¿Qué bolsillos generan rendimiento?


            {pockets.map((p) => (
              


                
                  
                  {p.name}
                
                
                    toggleYield.mutate({ id: p.id, on, balance: Number(p.current_balance) })
                  }
                />
              


            ))}
            

{YIELD_DISCLAIMER}


          


        
      



      {/* Debts + transactions + flows */}
      


        
          


            


              

Tarjetas · corte y pago


              


                Deuda total: {money(nw.liabilities)} · disponible{" "}
                {money(invisibleCash)}
              


            


            Ver todas
          


          {debts.length === 0 ? (
            

Aún no has agregado deudas.


          ) : (
            


              {cards.slice(0, 3).map((c) => {
                const card = c as DebtLike & { cutoff_day?: number | null; due_day?: number | null };
                if (!card.cutoff_day || !card.due_day) return null;
                const cycle = nextCutoffAndDue(card.cutoff_day, card.due_day);
                const limit = Number(c.credit_limit ?? 0);
                const used = limit > 0 ? Math.min(100, Math.round((Number(c.current_balance) / limit) * 100)) : 0;
                return (
                  


                    


                      {c.name}
                      {money(c.current_balance as number)}
                    


                    
                    


                      Corte {formatDateEs(cycle.cutoff)} ({cycle.daysToCutoff}d) · Pago {formatDateEs(cycle.due)} ({cycle.daysToDue}d)
                    


                    


                      {limit > 0
                        ? `Disponible: ${money(Math.max(0, limit - Number(c.current_balance)))}`
                        : "Define el límite de crédito para ver el disponible"}
                    


                  


                );
              })}
              {debts.filter((d) => d.debt_type !== "card").slice(0, 3).map((d) => (
                


                  {d.name}
                  {money(d.current_balance as number)}
                


              ))}
            


          )}
        

        
          


            

 Recientes


            Ver todas
          


          {recentTx.length === 0 ? (
            

Sin transacciones registradas.


          ) : (
            


              {recentTx.map((t) => (
                


                  


                    

{t.description || t.kind}


                    


                      {new Date(t.occurred_at).toLocaleDateString("es-MX")}
                    


                  


                  
                    {t.kind === "income" ? "+" : "−"}
                    {money(t.amount)}
                  
                


              ))}
            


          )}
        

        
          


            

Próximos flujos


            Gestionar
          


          {upcomingFlows.length === 0 ? (
            

Sin flujos programados.


          ) : (
            


              {upcomingFlows.map((f) => (
                


                  


                    

{f.title}


                    


                      {f.next_execution_date} · {f.frequency}
                    


                  


                  
                    {f.flow_type === "deposit" ? "+" : "−"}
                    {money(f.amount)}
                  
                


              ))}
            


          )}
        
      


    


  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    
      


        {label}
        
      


      

{value}


      {sub && 

{sub}

}
    
  );
}
