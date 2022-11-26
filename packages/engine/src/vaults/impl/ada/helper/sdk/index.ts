import { onekeyUtils } from 'cardano-coin-selection';

const CardanoApi = {
  composeTxPlan: onekeyUtils.composeTxPlan,
  signTransaction: onekeyUtils.signTransaction,
};

export { CardanoApi };
