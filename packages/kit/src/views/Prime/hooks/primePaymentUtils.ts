function extractCurrencySymbol(
  priceString: string,
  {
    useShortUSSymbol,
  }: {
    useShortUSSymbol?: boolean;
  } = {},
): string {
  const cleanString = priceString.replace(/^-/, '');
  const match = cleanString.match(/^[^0-9.-]*/);
  const r = match ? match[0] : '';
  if (useShortUSSymbol && r === 'US$') {
    return '$';
  }
  return r;
}

export default {
  extractCurrencySymbol,
};
