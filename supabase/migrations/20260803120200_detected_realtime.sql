-- Habilita realtime para las detecciones, para que el asistente-chat muestre
-- los movimientos al instante en cualquier sesión abierta (web y APK).
-- Defensivo: no falla si la tabla ya es miembro de la publicación.

do $$
begin
  alter publication supabase_realtime add table public.detected_transactions;
exception
  when duplicate_object then null;
  when undefined_object then null;  -- por si la publicación no existe en este entorno
end $$;

alter table public.detected_transactions replica identity full;
