/**
 * Convert human-readable amount to smallest unit (wei for ETH, satoshi for BTC).
 * Pure integer arithmetic — no floating point.
 */
export function amountToSmallestUnit(amount: string, decimals: number): string {
  const parts = amount.split('.');
  const wholePart = parts[0];
  const fracPart = (parts[1] ?? '').padEnd(decimals, '0').slice(0, decimals);
  const raw = `${wholePart}${fracPart}`.replace(/^0+/, '') || '0';
  return raw;
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
 * Estimate gas cost for display. Uses Number because API may return
 * decimal strings (e.g. "0.055" Gwei). Safe for display — gas values
 * are well within Number.MAX_SAFE_INTEGER.
 */
export function estimateGasCostDisplay(
  gasLimit: string,
  gasPrice: string,
  feeDecimals: number,
  feeSymbol: string,
): string {
  const limitNum = Number(gasLimit);
  const priceNum = Number(gasPrice);

  if (!Number.isFinite(limitNum) || !Number.isFinite(priceNum)) {
    return `unknown ${feeSymbol}`;
  }

  const gasCostWei = Math.floor(limitNum * priceNum).toString();
  return `${smallestUnitToDisplay(gasCostWei, feeDecimals)} ${feeSymbol}`;
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
 * Assumes 18 decimals (most common). Token decimals query can be added later.
 */
export function buildErc20EncodedTx(
  from: string,
  to: string,
  amount: string,
  tokenContract: string,
): Record<string, string> {
  const selector = 'a9059cbb';
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0');
  const weiAmount = BigInt(amountToSmallestUnit(amount, 18))
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
