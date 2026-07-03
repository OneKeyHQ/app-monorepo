import BigNumber from 'bignumber.js';

function toNonNegativeAmountBN(value?: string) {
  const amountBN = new BigNumber(value ?? '');
  if (!amountBN.isFinite() || amountBN.lt(0)) return undefined;
  return amountBN;
}

function isSamePositiveAmount({
  amount,
  targetAmount,
}: {
  amount: string;
  targetAmount?: string;
}) {
  const amountBN = new BigNumber(amount);
  const targetAmountBN = new BigNumber(targetAmount ?? '0');
  if (!amountBN.isFinite() || !targetAmountBN.isFinite()) return false;
  return amountBN.gt(0) && amountBN.eq(targetAmountBN);
}

function resolveRepayValueForMax({
  referenceBalance,
  maxRepayBalance,
  repayWalletBalance,
  repayAllTargetAmount,
}: {
  referenceBalance: string;
  maxRepayBalance?: string;
  repayWalletBalance?: string;
  repayAllTargetAmount?: string;
}) {
  const debtLimitAmount = repayAllTargetAmount ?? referenceBalance;
  const debtLimitBN = toNonNegativeAmountBN(debtLimitAmount);
  const maxRepayBN = toNonNegativeAmountBN(maxRepayBalance);
  if (maxRepayBN) {
    if (debtLimitBN?.gt(0) && maxRepayBN.gt(debtLimitBN)) {
      return debtLimitAmount;
    }
    return maxRepayBalance ?? '0';
  }

  const walletBN = toNonNegativeAmountBN(repayWalletBalance);
  if (walletBN) {
    if (debtLimitBN?.gt(0) && walletBN.gt(debtLimitBN)) {
      return debtLimitAmount;
    }
    return repayWalletBalance ?? '0';
  }

  return referenceBalance;
}

export function resolveProtocolLendingRepayAmountState({
  amount,
  referenceBalance,
  maxRepayBalance,
  repayWalletBalance,
  repayAllTargetAmount,
}: {
  amount: string;
  referenceBalance: string;
  maxRepayBalance?: string;
  repayWalletBalance?: string;
  repayAllTargetAmount?: string;
}) {
  const valueForMax = resolveRepayValueForMax({
    referenceBalance,
    maxRepayBalance,
    repayWalletBalance,
    repayAllTargetAmount,
  });
  const amountBN = toNonNegativeAmountBN(amount);
  const debtLimitBN = toNonNegativeAmountBN(
    repayAllTargetAmount ?? referenceBalance,
  );
  const maxRepayBN = toNonNegativeAmountBN(maxRepayBalance);
  const walletBN = toNonNegativeAmountBN(repayWalletBalance);
  const exceedsDebtLimit = Boolean(
    debtLimitBN?.gt(0) && amountBN?.gt(debtLimitBN),
  );
  const exceedsMaxRepay = Boolean(maxRepayBN && amountBN?.gt(maxRepayBN));
  const exceedsWallet = Boolean(walletBN && amountBN?.gt(walletBN));
  const isAmountInsufficient = Boolean(
    amountBN?.gt(0) && (exceedsDebtLimit || exceedsMaxRepay || exceedsWallet),
  );

  return {
    valueForMax,
    isAmountInsufficient,
    isFullClose: isSamePositiveAmount({
      amount,
      targetAmount: repayAllTargetAmount ?? referenceBalance,
    }),
  };
}
