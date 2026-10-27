import BigNumber from 'bignumber.js';

export function getHistoryFeeDisplayValues({
  gasFee,
  gasFeeFiatValue,
}: {
  gasFee?: string;
  gasFeeFiatValue?: string;
}) {
  const gasFeeBN = new BigNumber(gasFee ?? '');
  const isRefunded = gasFeeBN.isFinite() && gasFeeBN.lt(0);

  if (!isRefunded) {
    return {
      gasFee,
      gasFeeFiatValue,
      isRefunded,
    };
  }

  const gasFeeFiatValueBN = new BigNumber(gasFeeFiatValue ?? '');

  return {
    gasFee: gasFeeBN.abs().toFixed(),
    gasFeeFiatValue: gasFeeFiatValueBN.isFinite()
      ? gasFeeFiatValueBN.abs().toFixed()
      : gasFeeFiatValue,
    isRefunded,
  };
}
