import { onekeyUtils, trezorUtils } from 'cardano-coin-selection';

const CardanoApi = {
  composeTxPlan: onekeyUtils.composeTxPlan,
  signTransaction: onekeyUtils.signTransaction,
  hwSignTransaction: trezorUtils.signTransaction,
};

export { CardanoApi };
