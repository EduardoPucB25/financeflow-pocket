/**
 * Catálogo de apps bancarias/wallet conocidas. Sirve para:
 *  - Dar una etiqueta legible a un nombre de paquete (el chat/historial solo
 *    tiene `package_name`; no existe ningún otro mapeo en la app).
 *  - Poblar el selector de apps en su modo fallback (web / APK sin
 *    getInstalledApps) y resaltar los bancos conocidos dentro de la lista de
 *    apps instaladas.
 *
 * Los nombres de paquete de la lista por defecto que sí vigilamos viven en el
 * lado nativo (BankParsers.kt). Aquí incluimos además otros comunes para el
 * selector; un paquete equivocado es inofensivo (ninguna notificación coincide).
 */
export interface KnownApp {
  pkg: string;
  label: string;
  emoji: string;
  /** Color de marca para acentos de chip (opcional). */
  brand?: string;
}

export const KNOWN_APPS: KnownApp[] = [
  { pkg: "com.bbva.bbvacontigo", label: "BBVA", emoji: "🔷", brand: "#004481" },
  { pkg: "mx.com.santander.appsantander", label: "Santander", emoji: "🔴", brand: "#EC0000" },
  { pkg: "com.banorte.rmb.movil", label: "Banorte", emoji: "🟥", brand: "#EB0029" },
  { pkg: "com.nu.production", label: "Nu", emoji: "🟣", brand: "#820AD1" },
  { pkg: "com.mercadopago.wallet", label: "Mercado Pago", emoji: "🟡", brand: "#00AEEF" },
  { pkg: "com.bancoazteca.bazdigitalmovil", label: "Banco Azteca", emoji: "🟢", brand: "#0B7A3B" },
  { pkg: "com.hsbc.hsbcnetmobile", label: "HSBC", emoji: "🔺", brand: "#DB0011" },
  { pkg: "com.citibanamex.banamexmovil", label: "Citibanamex", emoji: "🔵", brand: "#0033A0" },
  { pkg: "com.revolut.revolut", label: "Revolut", emoji: "⚫", brand: "#0666EB" },
  { pkg: "com.klar.consumer", label: "Klar", emoji: "🩷", brand: "#EC0B8B" },
  { pkg: "com.storicard.stori", label: "Stori", emoji: "🟩", brand: "#00C08B" },
  { pkg: "com.uala.mx", label: "Ualá", emoji: "🔹", brand: "#0055FF" },
  { pkg: "com.spin.spinbyoxxo", label: "Spin by OXXO", emoji: "🔻", brand: "#E30613" },
  { pkg: "com.paypal.android.p2pmobile", label: "PayPal", emoji: "🅿️", brand: "#003087" },
];

const BY_PKG = new Map(KNOWN_APPS.map((a) => [a.pkg, a]));

export const isKnownApp = (pkg: string): boolean => BY_PKG.has(pkg);

/** Nombre legible de un paquete; cae al paquete crudo si no se conoce. */
export const appLabelFor = (pkg: string): string => BY_PKG.get(pkg)?.label ?? pkg;

export const appEmojiFor = (pkg: string): string => BY_PKG.get(pkg)?.emoji ?? "📱";

export const appBrandFor = (pkg: string): string | undefined => BY_PKG.get(pkg)?.brand;
