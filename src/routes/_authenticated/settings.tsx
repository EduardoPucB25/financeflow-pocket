import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — FinFlow" },
      { name: "description", content: "Configura tu ingreso, frecuencia de pago y tasa de rendimiento." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery()),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useSuspenseQuery(profileQuery());
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    biweekly_salary: Number(profile?.biweekly_salary ?? 5600),
    salary_frequency: profile?.salary_frequency ?? "biweekly",
    annual_yield_rate: Number(profile?.annual_yield_rate ?? 15),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        biweekly_salary: Number(profile.biweekly_salary),
        salary_frequency: profile.salary_frequency,
        annual_yield_rate: Number(profile.annual_yield_rate),
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("No auth");
      const { error } = await supabase
        .from("profiles")
        .update(form)
        .eq("id", user.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajustes guardados");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Personaliza tu perfil financiero.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ingreso por periodo</Label>
            <Input type="number" step="0.01" value={form.biweekly_salary} onChange={(e) => setForm({ ...form, biweekly_salary: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select value={form.salary_frequency} onValueChange={(v) => setForm({ ...form, salary_frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tasa anual de rendimiento (APY %)</Label>
            <Input type="number" step="0.1" value={form.annual_yield_rate} onChange={(e) => setForm({ ...form, annual_yield_rate: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Ej. 15% para Revolut México, Nu, CETES, etc.</p>
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Guardar cambios
        </Button>
      </Card>
    </div>
  );
}
