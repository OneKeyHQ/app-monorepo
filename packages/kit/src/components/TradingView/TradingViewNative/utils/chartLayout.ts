export function formatTradingViewNativePriceTick(price: number) {
  return Number(price.toPrecision(6)).toString();
}
