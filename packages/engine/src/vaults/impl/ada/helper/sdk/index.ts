import { LibLoader } from './loader';

const getCardanoApi = async () => {
  const Loader = await LibLoader();
  // @ts-ignore
  global.$$onekeyAdaSdkLoader = Loader;
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
