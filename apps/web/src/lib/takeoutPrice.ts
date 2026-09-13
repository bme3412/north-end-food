export const BOSTON_MEALS_TAX = 0.07;
export const APP_MARKUP_LOW = 0.2;
export const APP_MARKUP_HIGH = 0.35;

export type TakeoutQuote = {
  menu: number;
  pickup: number;
  appLow: number;
  appHigh: number;
};

export function menuAmount(price: string | number | null | undefined): number | null {
  if (price == null || price === "") return null;
  const amount = Number(price);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function takeoutQuote(price: string | number | null | undefined): TakeoutQuote | null {
  const menu = menuAmount(price);
  if (menu == null) return null;
  const pickup = roundCents(menu * (1 + BOSTON_MEALS_TAX));
  return {
    menu,
    pickup,
    appLow: roundCents(pickup * (1 + APP_MARKUP_LOW)),
    appHigh: roundCents(pickup * (1 + APP_MARKUP_HIGH)),
  };
}

export function formatMoney(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function formatAppBand(quote: TakeoutQuote): string {
  return `${formatMoney(quote.appLow)}–${formatMoney(quote.appHigh)}`;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
