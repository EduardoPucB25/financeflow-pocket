export const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined): string {
  return MXN.format(Number(n ?? 0));
}

export function pct(n: number | null | undefined): string {
  return `${Number(n ?? 0).toFixed(2)}%`;
}
