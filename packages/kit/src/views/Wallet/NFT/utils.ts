export function convertToMoneyFormat(number: string) {
  const absValue = Math.abs(Number(number));
  const units = [
    { unit: 'B', value: 1.0e9 },
    { unit: 'M', value: 1.0e6 },
    { unit: 'K', value: 1.0e3 },
  ];
  for (const { unit, value } of units) {
    if (absValue >= value) {
      return `${(absValue / value)
        .toFixed(2)
        .replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1')}${unit}`;
    }
  }
  return absValue.toString();
}
