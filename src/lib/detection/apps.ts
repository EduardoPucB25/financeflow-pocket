/**
 * Catálogo de apps bancarias/wallet conocidas. Sirve para:
 *  - Dar una etiqueta legible a un nombre de paquete (el chat/historial solo
 *    tiene `package_name`; no existe ningún otro mapeo en la app).
 *  - Poblar el selector de apps, que solo ofrece apps de banco o billetera.
 *
 * Los nombres de paquete de la lista por defecto que sí vigilamos viven en el
 * lado nativo (BankParsers.kt). Aquí incluimos además otros comunes para el
 * selector; un paquete equivocado es inofensivo (ninguna notificación coincide).
 */
export type AppKind = "bank" | "wallet";

export interface KnownApp {
  pkg: string;
  label: string;
  emoji: string;
  kind: AppKind;
  /** Color de marca para acentos de chip (opcional). */
  brand?: string;
}

export const KNOWN_APPS: KnownApp[] = [
  { pkg: "com.bbva.bbvacontigo", label: "BBVA", emoji: "🔷", kind: "bank", brand: "#004481" },
  { pkg: "mx.com.santander.appsantander", label: "Santander", emoji: "🔴", kind: "bank", brand: "#EC0000" },
  { pkg: "com.banorte.rmb.movil", label: "Banorte", emoji: "🟥", kind: "bank", brand: "#EB0029" },
  { pkg: "com.nu.production", label: "Nu", emoji: "🟣", kind: "bank", brand: "#820AD1" },
  { pkg: "com.mercadopago.wallet", label: "Mercado Pago", emoji: "🟡", kind: "wallet", brand: "#00AEEF" },
  { pkg: "com.bancoazteca.bazdigitalmovil", label: "Banco Azteca", emoji: "🟢", kind: "bank", brand: "#0B7A3B" },
  { pkg: "com.hsbc.hsbcnetmobile", label: "HSBC", emoji: "🔺", kind: "bank", brand: "#DB0011" },
  { pkg: "com.citibanamex.banamexmovil", label: "Citibanamex", emoji: "🔵", kind: "bank", brand: "#0033A0" },
  { pkg: "com.revolut.revolut", label: "Revolut", emoji: "⚫", kind: "wallet", brand: "#0666EB" },
  { pkg: "com.klar.consumer", label: "Klar", emoji: "🩷", kind: "bank", brand: "#EC0B8B" },
  { pkg: "com.storicard.stori", label: "Stori", emoji: "🟩", kind: "bank", brand: "#00C08B" },
  { pkg: "com.uala.mx", label: "Ualá", emoji: "🔹", kind: "wallet", brand: "#0055FF" },
  { pkg: "com.spin.spinbyoxxo", label: "Spin by OXXO", emoji: "🔻", kind: "wallet", brand: "#E30613" },
  { pkg: "com.paypal.android.p2pmobile", label: "PayPal", emoji: "🅿️", kind: "wallet", brand: "#003087" },
  { pkg: "com.didiglobal.passenger", label: "DiDi", emoji: "🟠", kind: "wallet", brand: "#FF7D41" },
  { pkg: "com.didi.pay.mx", label: "DiDi Pay", emoji: "🟠", kind: "wallet", brand: "#FF7D41" },
  { pkg: "com.rappi.pay.mx", label: "RappiCard", emoji: "🟧", kind: "bank", brand: "#FF441F" },
  { pkg: "mx.com.banregio.movil", label: "Banregio", emoji: "🟨", kind: "bank" },
  { pkg: "com.scotiabank.mx", label: "Scotiabank", emoji: "🔴", kind: "bank" },
  { pkg: "mx.hey.banco", label: "Hey Banco", emoji: "💚", kind: "bank" },
  { pkg: "com.inbursa.movil", label: "Inbursa", emoji: "🔵", kind: "bank" },
];

const BY_PKG = new Map(KNOWN_APPS.map((a) => [a.pkg, a]));

export const isKnownApp = (pkg: string): boolean => BY_PKG.has(pkg);

/** Nombre legible de un paquete; cae al paquete crudo si no se conoce. */
export const appLabelFor = (pkg: string): string => BY_PKG.get(pkg)?.label ?? pkg;

export const appEmojiFor = (pkg: string): string => BY_PKG.get(pkg)?.emoji ?? "📱";

export const appBrandFor = (pkg: string): string | undefined => BY_PKG.get(pkg)?.brand;

export const appKindFor = (pkg: string): AppKind | null => BY_PKG.get(pkg)?.kind ?? null;

/** Pistas para reconocer apps de dinero entre las instaladas en el teléfono. */
const MONEY_HINTS = [
  "bank", "banco", "banca", "bbva", "santander", "banorte", "hsbc", "banamex",
  "citi", "azteca", "scotia", "inbursa", "banregio", "afirme", "bajio",
  "nu.production", "nubank", "revolut", "wallet", "billetera", "pay", "pago",
  "klar", "stori", "uala", "spin", "oxxo", "paypal", "rappi", "didi",
  "finance", "fintech", "credit", "tarjeta", "cash", "money",
];

/**
 * ¿La app instalada parece de banco o billetera? Usamos el catálogo primero y,
 * si no, buscamos pistas en el nombre/paquete. Evita listar las 108 apps del
 * teléfono en el selector.
 */
export function looksLikeMoneyApp(pkg: string, label: string): boolean {
  if (isKnownApp(pkg)) return true;
  const hay = `${pkg} ${label}`.toLowerCase();
  return MONEY_HINTS.some((h) => hay.includes(h));
}
