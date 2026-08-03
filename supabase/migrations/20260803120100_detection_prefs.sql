-- Preferencias del asistente de movimientos por usuario.
--   detection_default_mode: modo por defecto al crear una regla nueva.
--   detection_autopilot: interruptor maestro para permitir/pausar el registro
--     automático de las reglas en modo 'auto'.

alter table public.profiles
  add column if not exists detection_default_mode text not null default 'ask',
  add column if not exists detection_autopilot boolean not null default false;
