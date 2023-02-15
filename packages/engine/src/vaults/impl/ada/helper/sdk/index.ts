const getCardanoApi = async () => {
  const Loader = await import('@onekeyfe/cardano-coin-selection');
  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
    dAppUtils: Loader.dAppUtils,
    txToOneKey: Loader.onekeyUtils.txToOneKey,
  };
};

/**
 * Web SDK is always successful
 */
const ensureSDKReady = async () => Promise.resolve(true);

export { getCardanoApi, ensureSDKReady };
