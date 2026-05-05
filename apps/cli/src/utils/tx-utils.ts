import { AppError, ERROR_CODES } from '../errors';

/**
 * Convert human-readable amount to smallest unit (wei for ETH, satoshi for BTC).
 * Pure integer arithmetic — no floating point.
 */
export function amountToSmallestUnit(amount: string, decimals: number): string {
  const parts = amount.split('.');
  const wholePart = parts[0];
  const rawFrac = parts[1] ?? '';
  const fracPart = rawFrac.padEnd(decimals, '0').slice(0, decimals);
  const raw = `${wholePart}${fracPart}`.replace(/^0+/, '') || '0';
  return raw;
}

/**
 * Validate that user-supplied amount doesn't exceed the allowed decimal places.
 * Call this on user inputs BEFORE amountToSmallestUnit.
 */
export function validateAmountDecimals(amount: string, decimals: number): void {
  const frac = amount.split('.')[1] ?? '';
  if (frac.length > decimals) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_AMOUNT.code,
      `Amount has ${frac.length} decimal places but max is ${decimals}`,
      `Use at most ${decimals} decimal places`,
    );
  }
}

/**
 * Convert smallest unit back to human-readable display string.
 */
export function smallestUnitToDisplay(wei: string, decimals: number): string {
  const padded = wei.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const frac = padded.slice(padded.length - decimals);
  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/**
 * Estimate gas cost for display.
 * gasPrice is in API units (defined by feeDecimals, e.g. Gwei when feeDecimals=9).
 * Result: gasLimit * gasPrice converted to native token display.
 */
export function estimateGasCostDisplay(
  gasLimit: string,
  gasPrice: string,
  feeDecimals: number,
  feeSymbol: string,
  nativeDecimals: number,
): string {
  // Validate inputs are parseable before doing any arithmetic
  if (!/^\d+$/.test(gasLimit) || !/^\d+\.?\d*$/.test(gasPrice)) {
    return `unknown ${feeSymbol}`;
  }

  try {
    // Convert gasPrice from feeDecimals units to wei (integer string) via string
    // arithmetic, then multiply by gasLimit using BigInt — no floating-point anywhere.
    // e.g. 20 Gwei (feeDecimals=9) → "20000000000" wei; × 21000 = "420000000000000" wei
    const gasPriceWei = amountToSmallestUnit(gasPrice, feeDecimals);
    const costWei = (BigInt(gasPriceWei) * BigInt(gasLimit)).toString();
    return `${smallestUnitToDisplay(costWei, nativeDecimals)} ${feeSymbol}`;
  } catch {
    return `unknown ${feeSymbol}`;
  }
}

/**
 * Convert a fee value from API units to wei hex string.
 * API returns gas prices in units defined by feeDecimals (e.g. Gwei when feeDecimals=9).
 * Core library expects wei as hex. Mirrors App's: toBigIntHex(new BigNumber(val).shiftedBy(feeDecimals))
 */
export function feeToWeiHex(value: string, feeDecimals: number): string {
  // If the API returns more decimal places than feeDecimals (floating-point
  // representation artifact), truncate explicitly so the caller always gets a
  // deterministic result. This is intentional — gas precision beyond feeDecimals
  // is sub-wei and has no effect on the signed fee.
  const [whole, frac = ''] = value.split('.');
  const normalized =
    frac.length > feeDecimals
      ? `${whole}.${frac.slice(0, feeDecimals)}`
      : value;
  const shifted = amountToSmallestUnit(normalized, feeDecimals);
  return `0x${BigInt(shifted).toString(16)}`;
}

/**
 * Build EVM native transfer encodedTx.
 */
export function buildNativeEncodedTx(
  from: string,
  to: string,
  amount: string,
  nativeDecimals: number,
): Record<string, string> {
  return {
    from,
    to,
    value: `0x${BigInt(amountToSmallestUnit(amount, nativeDecimals)).toString(16)}`,
  };
}

/**
 * Build ERC-20 transfer encodedTx.
 * `tokenDecimals` MUST come from on-chain or API token metadata — never hardcode.
 */
export function buildErc20EncodedTx(
  from: string,
  to: string,
  amount: string,
  tokenContract: string,
  tokenDecimals: number,
): Record<string, string> {
  const selector = 'a9059cbb';
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0');
  const weiAmount = BigInt(amountToSmallestUnit(amount, tokenDecimals))
    .toString(16)
    .padStart(64, '0');
  const data = `0x${selector}${paddedTo}${weiAmount}`;

  return {
    from,
    to: tokenContract,
    data,
    value: '0x0',
  };
}
