import BigNumber from 'bignumber.js';

export const buildLocalTxStatusSyncId = ({
  providerName = '',
  tokenSymbol = '',
}: {
  providerName?: string;
  tokenSymbol?: string;
}) => `${providerName?.toLowerCase()}-${tokenSymbol?.toLowerCase()}`;

export function capitalizeString(str: string): string {
  if (!str) return str; // Return if the string is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function countDecimalPlaces(input: string | number): number {
  // Convert the input to a string if it's a number
  const inputNum = typeof input === 'string' ? Number(input) : input;

  if (Number.isNaN(inputNum)) {
    return 0;
  }

  const inputStr =
    typeof input === 'string' ? input : BigNumber(input).toFixed();

  // Find the decimal point
  const decimalIndex = inputStr.indexOf('.');

  // If there's no decimal point, return 0
  if (decimalIndex === -1) {
    return 0;
  }

  // Return the number of characters after the decimal point
  return inputStr.length - decimalIndex - 1;
}
