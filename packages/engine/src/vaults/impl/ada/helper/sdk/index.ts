import { onekeyUtils } from 'cardano-coin-selection';

const CardanoApi = {
  // TODO: become a async function
  composeTxPlan: onekeyUtils.composeTxPlan,
  signTransaction: onekeyUtils.signTransaction,
};

export { CardanoApi };
