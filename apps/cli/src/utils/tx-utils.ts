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
  const limitNum = Number(gasLimit);
  const priceNum = Number(gasPrice);

  if (!Number.isFinite(limitNum) || !Number.isFinite(priceNum)) {
    return `unknown ${feeSymbol}`;
  }

  // gasLimit * gasPrice = cost in API units (e.g. Gwei)
  // Convert to wei by shifting, then display in native token
  const costInApiUnits = limitNum * priceNum;
  const costWei = amountToSmallestUnit(costInApiUnits.toString(), feeDecimals);
  return `${smallestUnitToDisplay(costWei, nativeDecimals)} ${feeSymbol}`;
}

/**
 * Convert a fee value from API units to wei hex string.
 * API returns gas prices in units defined by feeDecimals (e.g. Gwei when feeDecimals=9).
 * Core library expects wei as hex. Mirrors App's: toBigIntHex(new BigNumber(val).shiftedBy(feeDecimals))
 */
export function feeToWeiHex(value: string, feeDecimals: number): string {
  const shifted = amountToSmallestUnit(value, feeDecimals);
  return `0x${BigInt(shifted).toString(16)}`;
}

/**
 * Build EVM native transfer encodedTx.
 */
export function buildNativeEncodedTx(
  from: string,
  to: string,
  amount: string,
): Record<string, string> {
  return {
    from,
    to,
    value: `0x${BigInt(amountToSmallestUnit(amount, 18)).toString(16)}`,
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
