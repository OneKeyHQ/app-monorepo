const LibLoader = async () => import('cardano-coin-selection');

const getCardanoApi = async () => {
  const Loader = await LibLoader();
  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
  };
};

export { getCardanoApi };
