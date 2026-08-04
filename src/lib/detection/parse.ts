/**
 * Extractores finos para notificaciones bancarias: quién envía/recibe, la
 * fecha/hora escrita dentro del mensaje y la cuenta o banco mencionado.
 *
 * Vive en la capa web (no en el parser nativo) para poder afinarlo sin
 * recompilar el APK: el evento `bankNotification` siempre trae el texto crudo.
 */

export const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const norm = (s: string): string => stripAccents(s.toLowerCase()).replace(/\s+/g, " ").trim();

// ---- Nombre de la persona / contraparte ------------------------------------

/** Palabras que nunca son nombre propio aunque el regex las capture. */
const NAME_STOPWORDS = new Set([
  "tu", "tus", "su", "sus", "una", "un", "la", "el", "los", "las", "cuenta",
  "tarjeta", "transferencia", "deposito", "pago", "saldo", "banco", "spei",
  "you", "your", "the", "a", "an", "card", "account", "payment", "transfer",
]);

const NAME_CHARS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

/** Patrones donde el nombre aparece ANTES del verbo. */
const NAME_BEFORE: RegExp[] = [
  new RegExp(`([${NAME_CHARS}][${NAME_CHARS}\\s.'-]{2,40}?)\\s+(?:te\\s+(?:envio|envió|transfirio|transfirió|deposito|depositó|mando|mandó)|hizo\\s+una\\s+transferencia|realizo\\s+una\\s+transferencia|realizó\\s+una\\s+transferencia|te\\s+ha\\s+enviado|sent\\s+you|paid\\s+you)`, "i"),
];

/** Patrones donde el nombre aparece DESPUÉS de una preposición. */
const NAME_AFTER: RegExp[] = [
  new RegExp(`(?:de\\s+parte\\s+de|recibiste\\s+(?:de|dinero\\s+de)|transferencia\\s+de|deposito\\s+de|depósito\\s+de|pago\\s+de|enviaste\\s+a|transferiste\\s+a|pagaste\\s+a|payment\\s+from|received\\s+from|from|to)\\s+([${NAME_CHARS}][${NAME_CHARS}\\s.'-]{2,40})`, "i"),
];

const cleanName = (raw: string): string | null => {
  let n = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  // Cortar en conectores/monedas que arrastra el regex.
  n = n.split(/\s+(?:por|de|el|la|con|the|for|on|at)\s+/i)[0].trim();
  n = n.replace(/\s*\d.*$/, "").trim();
  if (n.length < 3) return null;
  const words = n.split(" ").filter(Boolean);
  if (words.every((w) => NAME_STOPWORDS.has(norm(w)))) return null;
  if (words.length > 5) return null;
  return n;
};

/** Nombre de quien envía o recibe el dinero, si el mensaje lo dice. */
export function parsePersonName(text: string): string | null {
  for (const re of NAME_BEFORE) {
    const m = text.match(re);
    if (m) {
      const n = cleanName(m[1]);
      if (n) return n;
    }
  }
  for (const re of NAME_AFTER) {
    const m = text.match(re);
    if (m) {
      const n = cleanName(m[1]);
      if (n) return n;
    }
  }
  return null;
}

/** ¿El nombre detectado corresponde al propio usuario (traspaso entre cuentas)? */
export function isSelfName(name: string | null, aliases: string[] | null | undefined): boolean {
  if (!name || !aliases?.length) return false;
  const n = norm(name);
  return aliases.some((a) => {
    const alias = norm(a);
    return alias.length >= 3 && (n === alias || n.includes(alias) || alias.includes(n));
  });
}

// ---- Cuenta / banco --------------------------------------------------------

const BANK_WORDS = [
  "bbva", "nu", "nubank", "revolut", "didi", "mercado pago", "mercadopago",
  "santander", "banorte", "hsbc", "citibanamex", "banamex", "banco azteca",
  "azteca", "klar", "stori", "uala", "spin", "oxxo", "paypal", "scotiabank",
  "inbursa", "banregio", "afirme", "banbajio", "hey banco", "rappicard",
];

/**
 * Cuenta o banco mencionado: "a tu cuenta Nu", "tarjeta terminada en 1234",
 * "cuenta ****5678". Devuelve algo legible tipo "Nu ···1234".
 */
export function parseAccountHint(text: string): string | null {
  const hay = norm(text);

  let bank: string | null = null;
  for (const w of BANK_WORDS) {
    const re = new RegExp(`(?:^|[^a-z])${w}(?:[^a-z]|$)`);
    if (re.test(hay)) {
      bank = w;
      break;
    }
  }

  const digits =
    text.match(/(?:terminada|terminación|terminacion|final(?:izada)?|ending)\s*(?:en|in|con)?\s*[*·•x]*\s*(\d{3,4})/i)?.[1] ??
    text.match(/(?:cuenta|tarjeta|card|account)\s*[*·•x]{2,}\s*(\d{3,4})/i)?.[1] ??
    text.match(/[*·•x]{3,}\s*(\d{4})/i)?.[1] ??
    null;

  const named = text.match(/(?:a|en|de)\s+tu\s+cuenta\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][\w ]{1,20})/i)?.[1]?.trim();

  const label = bank
    ? bank.replace(/\b\w/g, (c) => c.toUpperCase())
    : named
      ? named.split(/\s+(?:de|por|el|la)\s+/i)[0].trim()
      : null;

  if (!label && !digits) return null;
  return [label, digits ? `···${digits}` : null].filter(Boolean).join(" ");
}

// ---- Fecha y hora ----------------------------------------------------------

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8,
  oct: 9, nov: 10, dic: 11,
};

const fullYear = (y: number): number => (y < 100 ? 2000 + y : y);

function parseTimeOfDay(hay: string): { h: number; m: number } | null {
  const m = hay.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?|am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const suffix = m[3]?.toLowerCase().replace(/\./g, "");
  if (suffix === "pm" && h < 12) h += 12;
  if (suffix === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/**
 * Fecha/hora escrita dentro del mensaje. Acepta `01-08-26`, `01/08/2026`,
 * `1 de agosto de 2026`, `hoy`, `ayer`, con hora opcional (`10:15 a.m.`).
 * Devuelve ISO o null si el texto no dice nada (entonces se usa la hora de
 * la notificación).
 */
export function parseMessageDate(text: string, now: Date = new Date()): string | null {
  const hay = norm(text);
  const time = parseTimeOfDay(hay);

  const build = (y: number, mo: number, d: number): string | null => {
    const dt = new Date(y, mo, d, time?.h ?? 12, time?.m ?? 0, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const numeric = hay.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (numeric) {
    const d = Number(numeric[1]);
    const mo = Number(numeric[2]);
    const y = fullYear(Number(numeric[3]));
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return build(y, mo - 1, d);
  }

  const textual = hay.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})\.?(?:\s*(?:de|del)\s*(\d{2,4}))?/);
  if (textual) {
    const mo = MONTHS[textual[2]];
    if (mo !== undefined) {
      const d = Number(textual[1]);
      const y = textual[3] ? fullYear(Number(textual[3])) : now.getFullYear();
      if (d >= 1 && d <= 31) return build(y, mo, d);
    }
  }

  if (/\bhoy\b|\btoday\b/.test(hay)) return build(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bayer\b|\byesterday\b/.test(hay)) {
    const y = new Date(now.getTime() - 86400000);
    return build(y.getFullYear(), y.getMonth(), y.getDate());
  }

  // Solo hora ("10:15") → hoy a esa hora.
  if (time) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.h, time.m);
    return dt.toISOString();
  }

  return null;
}
