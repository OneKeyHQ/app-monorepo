import BigNumber from 'bignumber.js';

export function requiresEtherFiUsdtReset({
  isEtherFi,
  isUsdt,
  loadingAllowance,
  allowance,
  amount,
}: {
  isEtherFi: boolean;
  isUsdt: boolean;
  loadingAllowance: boolean;
  allowance: string;
  amount: string;
}) {
  if (!isEtherFi || !isUsdt || loadingAllowance) return false;
  const allowanceBN = new BigNumber(allowance);
  const amountBN = new BigNumber(amount);
  return (
    allowanceBN.isFinite() &&
    allowanceBN.gt(0) &&
    amountBN.isFinite() &&
    amountBN.gt(allowanceBN)
  );
}
