import BigNumber from 'bignumber.js';

export function calcPrivateSendNativeTokenMaxAmount({
  balance,
  reserveGas,
  decimals,
}: {
  balance?: string;
  reserveGas?: string | number;
  decimals?: number;
}) {
  const balanceBN = new BigNumber(balance ?? '');
  if (!balanceBN.isFinite() || balanceBN.lte(0)) {
    return '0';
  }

  const reserveGasBN = new BigNumber(reserveGas ?? '');
  const maxAmountBN =
    reserveGasBN.isFinite() && reserveGasBN.gt(0)
      ? BigNumber.max(0, balanceBN.minus(reserveGasBN))
      : balanceBN;
  const amountDecimals =
    Number.isInteger(decimals) && Number(decimals) >= 0
      ? Number(decimals)
      : (balanceBN.decimalPlaces() ?? 0);

  return maxAmountBN
    .decimalPlaces(amountDecimals, BigNumber.ROUND_DOWN)
    .toFixed();
}
