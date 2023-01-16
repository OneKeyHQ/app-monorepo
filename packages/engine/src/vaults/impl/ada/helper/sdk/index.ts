const getCardanoApi = async () => {
  const Loader = await import('cardano-coin-selection');
  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
    dAppUtils: Loader.dAppUtils,
  };
};

/**
 * Web SDK is always successful
 */
const ensureSDKReady = async () => Promise.resolve(true);

export { getCardanoApi, ensureSDKReady };
