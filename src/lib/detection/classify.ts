/**
 * Clasificador de notificaciones bancarias en la capa web.
 *
 * El parser nativo (BankParsers.kt) hace un primer vistazo, pero solo cubre
 * unas pocas apps y en español. Como el APK carga el JS desde producción y el
 * evento `bankNotification` incluye el `rawText`, aquí re-clasificamos CUALQUIER
 * notificación (incluida Revolut, en inglés y multi-moneda) sin recompilar.
 *
 * Todas las palabras clave editables viven en este archivo, en un solo lugar.
 */

import { parsePersonName, parseAccountHint, parseMessageDate } from "./parse";

export type Direction = "in" | "out" | "unknown";
export type TxKind = "income" | "expense" | "payment";

export interface ClassifyInput {
  title?: string | null;
  text?: string | null;
  raw?: string | null;
  /** Tipo del parser nativo: charge|credit|transfer|payment|unknown. */
  hintedType?: string | null;
  hintedAmount?: number | null;
  hintedMerchant?: string | null;
}

export interface Classification {
  direction: Direction;
  kind: TxKind;
  amount: number | null;
  currency: string;
  merchant: string | null;
  /** Persona o comercio que envía/recibe, si el mensaje lo dice. */
  senderName: string | null;
  /** Cuenta o banco mencionado ("Nu", "BBVA ···1234"). */
  accountHint: string | null;
  /** Fecha/hora leída DENTRO del mensaje (ISO) o null. */
  occurredAt: string | null;
  /** 0..1 — qué tan seguros estamos de la dirección/tipo. */
  confidence: number;
}


// ---- Diccionarios (ES + EN) — editar aquí ---------------------------------

/** Dinero que SALE (gasto / envío / compra / retiro). */
export const OUT_WORDS = [
  // español
  "transferiste", "transferi", "enviaste", "envie", "envio", "mandaste",
  "pagaste", "pague", "compra", "compraste", "cargo", "retiro", "retiraste",
  "gastaste", "debito", "cargamos", "realizaste un pago", "hiciste una compra",
  "se realizo un cargo", "cargo por", "salida de dinero", "enviado a",
  "transferencia enviada", "pago realizado", "pago exitoso", "viaje pagado",
  // inglés (Revolut y otras)
  "you sent", "you paid", "payment to", "purchase", "you spent", "spent at",
  "withdrawal", "withdrew", "charged", "debited", "sent to",
];

/** Dinero que ENTRA (ingreso / depósito / devolución). */
export const IN_WORDS = [
  // español
  "recibiste", "recibi", "recibo", "te depositaron", "deposito", "abono",
  "ingreso", "devolucion", "reembolso", "te enviaron", "cobraste", "recibida",
  "abonamos", "recibimos", "te transfirio", "te envio", "te ha enviado",
  "hizo una transferencia a tu cuenta", "transferencia recibida",
  "dinero disponible", "te llego", "acreditamos", "acreditado",
  // inglés
  "you received", "received", "deposit", "refund", "added to", "top-up",
  "topped up", "cashback", "you got", "money in",
];


/** Pago de TU tarjeta/deuda (sale de un bolsillo y baja la deuda). */
export const PAYMENT_WORDS = [
  "pago a tu tarjeta", "pago de tarjeta", "pago tarjeta", "abono a credito",
  "abono a tu credito", "pago de deuda", "pago a credito", "pago tdc",
  "pago a tu credito", "card payment", "credit card payment",
];

/**
 * Frases inequívocas de ENTRADA. Ganan sobre cualquier palabra de salida:
 * "te envió", "hizo una transferencia a tu cuenta" contienen "envio"/
 * "transfer", que de otro modo marcarían salida.
 */
export const STRONG_IN_WORDS = [
  "te envio", "te enviaron", "te ha enviado", "te transfirio", "te deposito",
  "te depositaron", "a tu cuenta", "recibiste", "transferencia recibida",
  "abono a tu cuenta", "sent you", "you received", "received from",
];


// ---- Helpers --------------------------------------------------------------

const strip = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const hasAny = (hay: string, words: string[]): boolean =>
  words.some((w) => hay.includes(w));

/**
 * Convierte un número con separadores US (`1,234.56`) o europeos (`1.234,56`)
 * a Number. Desambigua un separador único por la cantidad de dígitos que le
 * siguen (3 → miles, otro → decimal).
 */
export function normalizeAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else {
    const sepIdx = Math.max(lastComma, lastDot);
    if (sepIdx !== -1) {
      const sep = s[sepIdx];
      const digitsAfter = s.length - sepIdx - 1;
      if (digitsAfter === 3) {
        s = s.split(sep).join(""); // separador de miles → quitar
      } else {
        s = s.replace(/,/g, ".");
      }
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function extractAmountAndCurrency(hayLower: string): { amount: number | null; currency: string } {
  let currency = "MXN";
  if (/€|\beur\b|euros?/.test(hayLower)) currency = "EUR";
  else if (/£|\bgbp\b/.test(hayLower)) currency = "GBP";
  else if (/\busd\b|dlls?|dolar|dólar/.test(hayLower)) currency = "USD";

  const patterns = [
    /(?:mxn|usd|eur|gbp|\$|€|£)\s?(\d[\d.,]*)/i,
    /(\d[\d.,]*)\s?(?:mxn|usd|eur|gbp|€|£|pesos|dolares|dólares|euros)/i,
  ];
  for (const re of patterns) {
    const m = hayLower.match(re);
    if (m) {
      const num = normalizeAmount(m[1]);
      if (num != null && num > 0) return { amount: num, currency };
    }
  }
  return { amount: null, currency };
}

function extractMerchant(originalText: string): string | null {
  const m = originalText.match(
    /(?:en|a|de|to|at|from)\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][\w .&'-]{2,40})/,
  );
  if (!m) return null;
  let mer = m[1].trim();
  // Cortar en el primer número ("OXXO por 89.90" → "OXXO por") ...
  mer = mer.replace(/\s*\d.*$/, "").trim();
  // ... y en conectores de cola que arrastra el regex.
  mer = mer.split(/\s+(?:por|de|con|the|for)\s+/i)[0].trim();
  mer = mer.replace(/\s+(?:por|de|con)$/i, "").replace(/[.,;:]+$/, "").trim();
  return mer || null;
}

function directionFromHint(hintedType?: string | null): { direction: Direction; kind: TxKind } | null {
  switch (hintedType) {
    case "charge":
      return { direction: "out", kind: "expense" };
    case "credit":
      return { direction: "in", kind: "income" };
    case "payment":
      return { direction: "out", kind: "payment" };
    default:
      return null; // transfer/unknown/null → sin señal fiable
  }
}

// ---- API ------------------------------------------------------------------

export function classifyNotification(input: ClassifyInput): Classification {
  const original = `${input.title ?? ""} ${input.text ?? ""} ${input.raw ?? ""}`.trim();
  const hay = strip(original);

  const isPayment = hasAny(hay, PAYMENT_WORDS);
  const strongIn = hasAny(hay, STRONG_IN_WORDS);
  const inHit = strongIn || hasAny(hay, IN_WORDS);
  const outHit = !strongIn && hasAny(hay, OUT_WORDS);


  let direction: Direction;
  let kind: TxKind;
  let confidence: number;

  if (isPayment) {
    direction = "out";
    kind = "payment";
    confidence = 0.9;
  } else if (inHit && !outHit) {
    direction = "in";
    kind = "income";
    confidence = 0.9;
  } else if (outHit && !inHit) {
    direction = "out";
    kind = "expense";
    confidence = 0.9;
  } else {
    // Ambiguo o sin palabras clave → usar la pista del parser nativo.
    const fromHint = directionFromHint(input.hintedType);
    if (fromHint) {
      direction = fromHint.direction;
      kind = fromHint.kind;
      confidence = 0.5;
    } else if (inHit && outHit) {
      // Ambas señales: por seguridad tratamos como gasto (revisable en el chat).
      direction = "out";
      kind = "expense";
      confidence = 0.35;
    } else {
      direction = "unknown";
      kind = "expense";
      confidence = 0.2;
    }
  }

  const extracted = extractAmountAndCurrency(hay);
  const amount = input.hintedAmount ?? extracted.amount;
  const senderName = parsePersonName(original);
  const merchant = input.hintedMerchant?.trim() || extractMerchant(original) || senderName;

  return {
    direction,
    kind,
    amount,
    currency: extracted.currency,
    merchant: merchant || null,
    senderName,
    accountHint: parseAccountHint(original),
    occurredAt: parseMessageDate(original),
    confidence,
  };
}

