function extractCurrencySymbol(
  priceString: string | undefined,
  {
    useShortUSSymbol,
  }: {
    useShortUSSymbol?: boolean;
  } = {},
): string {
  const cleanString = (priceString || '').replace(/^-/, '');
  const match = cleanString.match(/^[^0-9.-]*/);
  let r = match ? match?.[0] : '';
  r = r || '';
  if (useShortUSSymbol && r === 'US$') {
    return '$';
  }
  return r;
}

export default {
  extractCurrencySymbol,
};
