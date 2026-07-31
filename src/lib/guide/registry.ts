/**
 * Per-screen guided-tour definitions ("get started").
 * A step without `target` renders as a centered modal; with `target` it
 * spotlights the first element matching [data-guide="<target>"].
 */
export interface GuideStep {
  target?: string;
  title: string;
  body: string;
}

export const GUIDE_REGISTRY: Record<string, GuideStep[]> = {
  "/dashboard": [
    {
      title: "Tu panel",
      body: "Aquí ves tu panorama completo: cuánto tienes, cuánto debes y qué sigue. Te mostramos las piezas clave en unos segundos.",
    },
    {
      target: "hero-stats",
      title: "Tus números de hoy",
      body: "Balance total, patrimonio neto, rendimiento acumulado y cuántos días faltan para tu próximo pago. Se actualizan solos con cada movimiento.",
    },
    {
      target: "por-pagar",
      title: "Por pagar",
      body: "Los pagos de tarjetas y deudas de esta semana o del mes. Toca \"Gestionar\" para ir a Deudas y marcarlos como pagados.",
    },
    {
      target: "distribucion",
      title: "Distribución por bolsillos",
      body: "Cómo se reparte tu ingreso entre tus bolsillos. Si no suman 100%, ajústalos en la sección Bolsillos.",
    },
    {
      target: "rendimiento",
      title: "Rendimiento compuesto",
      body: "La proyección de tu dinero generando interés diario. Configura tu tasa (APY) en Ajustes.",
    },
  ],
  "/pockets": [
    {
      title: "Bolsillos",
      body: "Cada bolsillo es una parte de tu ingreso con un propósito: gastar, ahorrar o invertir. Empiezas con 4, inspirados en el método 50/15/25/10.",
    },
    {
      target: "pockets-resumen",
      title: "Total asignado",
      body: "Verifica que tus porcentajes sumen 100% y revisa cuánto tienes disponible para gastar hoy.",
    },
    {
      target: "nuevo-bolsillo",
      title: "Crea un bolsillo",
      body: "Define nombre, porcentaje de tu ingreso y si genera rendimiento. Ajusta los porcentajes hasta que reflejen tu realidad.",
    },
    {
      target: "pockets-list",
      title: "Tus bolsillos en detalle",
      body: "Saldo actual, porcentaje y rendimiento acumulado. Usa \"Aplicar rendimiento\" para abonar el interés generado.",
    },
  ],
  "/debts": [
    {
      title: "Deudas y tarjetas",
      body: "Registra tarjetas, préstamos y otras deudas para controlar cortes, fechas de pago y crédito disponible.",
    },
    {
      target: "debts-resumen",
      title: "Tu resumen",
      body: "Total de deuda, pago mínimo mensual y tu Invisible Cash: el dinero que puedes usar sin intereses gracias al periodo de gracia.",
    },
    {
      target: "nueva-deuda",
      title: "Agrega una deuda",
      body: "Para tarjetas, captura el día de corte y el día de pago: con eso la app calcula tus ciclos y fechas límite.",
    },
    {
      target: "debt-statements",
      title: "Pagos mensuales",
      body: "Captura el saldo de cada estado de cuenta y márcalo como pagado. Esto alimenta la sección \"Por pagar\" de tu panel.",
    },
    {
      target: "debt-ciclos",
      title: "Ciclos de tu tarjeta",
      body: "Cada tarjeta muestra su ciclo actual, el cerrado por pagar y el próximo, con los cargos y pagos del periodo.",
    },
  ],
  "/transactions": [
    {
      title: "Movimientos",
      body: "Todo lo que entra y sale: ingresos, gastos, transferencias entre bolsillos y pagos a tarjetas.",
    },
    {
      target: "registrar",
      title: "Registra un movimiento",
      body: "Elige el tipo (ingreso, gasto, transferencia o pago de deuda), el bolsillo y, si aplica, la tarjeta. Tu saldo se actualiza al instante.",
    },
    {
      target: "contrapartes",
      title: "Contrapartes",
      body: "Guarda personas o negocios con los que repites operaciones (préstamos, clientes) para reutilizarlos al registrar.",
    },
    {
      target: "tx-lista",
      title: "Tu historial",
      body: "Los movimientos más recientes primero. Puedes editarlos o borrarlos si te equivocaste.",
    },
  ],
  "/inbox": [
    {
      title: "Bandeja de detección",
      body: "Si usas la app en Android con la detección activada, las notificaciones de tu banco aparecen aquí como movimientos sugeridos.",
    },
    {
      target: "inbox-pendientes",
      title: "Pendientes",
      body: "Revisa cada detección: \"Aprobar\" la convierte en movimiento eligiendo bolsillo o tarjeta; \"Descartar\" la ignora.",
    },
    {
      title: "Actívala en Ajustes",
      body: "Ve a Ajustes → Detección automática (Android) para instalar la app en tu teléfono y otorgar el permiso de notificaciones.",
    },
  ],
  "/flows": [
    {
      title: "Flujos programados",
      body: "Ingresos o pagos que se repiten: nómina, renta, suscripciones. La app los proyecta en tu panel.",
    },
    {
      target: "nuevo-flujo",
      title: "Crea un flujo",
      body: "Define monto, frecuencia y el bolsillo al que entra o del que sale. La próxima fecha se calcula sola.",
    },
    {
      target: "flows-lista",
      title: "Próximas ejecuciones",
      body: "Tus flujos ordenados por fecha. En el panel verás los que vienen en los próximos días.",
    },
  ],
  "/simulator": [
    {
      title: "Simulador de rendimiento",
      body: "Proyecta cuánto crecería tu dinero con interés compuesto diario, aportes y retiros periódicos.",
    },
    {
      target: "sim-parametros",
      title: "Parámetros",
      body: "Saldo inicial, tasa anual, horizonte y aportes. Cambia un valor y la proyección se actualiza al momento.",
    },
    {
      target: "sim-proyeccion",
      title: "Proyección",
      body: "La curva de tu dinero en el tiempo. Compárala combinada o por bolsillo.",
    },
    {
      target: "sim-guardar",
      title: "Guarda escenarios",
      body: "Guarda las combinaciones que te interesen y recupéralas después para compararlas.",
    },
  ],
  "/networth": [
    {
      title: "Capital y patrimonio",
      body: "Tu foto completa: lo que tienes menos lo que debes, y cómo evolucionan tus gastos. Esta pantalla es de lectura: se alimenta de tus movimientos.",
    },
    {
      target: "nw-stats",
      title: "Patrimonio neto",
      body: "Bolsillos menos deudas. Si es negativo, tu prioridad es el plan de pagos; la app te ayuda a ordenarlo.",
    },
    {
      target: "nw-flujo",
      title: "Ingresos vs gastos",
      body: "Seis meses de historia para detectar tendencias y saber si tu mes cierra en positivo.",
    },
  ],
  "/settings": [
    {
      title: "Ajustes",
      body: "Aquí configuras tu perfil financiero. Dedícale 2 minutos: todo lo demás se calcula con estos datos.",
    },
    {
      target: "settings-perfil",
      title: "Tu perfil financiero",
      body: "Ingreso por periodo, frecuencia, tasa de rendimiento y tus días de pago, para que el contador de \"Próximo pago\" sea exacto.",
    },
    {
      target: "settings-deteccion",
      title: "Detección automática (Android)",
      body: "Descarga el APK y otorga acceso a notificaciones para que tus compras se registren solas en la Bandeja.",
    },
    {
      target: "settings-suscripcion",
      title: "Suscripción",
      body: "Consulta tu plan actual, administra tu pago o sube a Pro cuando lo necesites.",
    },
  ],
  "/upgrade": [
    {
      title: "Planes",
      body: "El plan Gratis te deja probar el sistema completo con límites. Pro quita los límites y activa la automatización.",
    },
    {
      target: "plan-pro",
      title: "Pro",
      body: "Bolsillos y deudas ilimitados, detección de notificaciones en Android y simulador avanzado. Cancela cuando quieras.",
    },
  ],
};

/** Map a pathname to its registry key by top-level segment. */
export function guideKeyForPath(pathname: string): string | null {
  const key = "/" + (pathname.split("/")[1] ?? "");
  return key in GUIDE_REGISTRY ? key : null;
}
