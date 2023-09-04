// import { registerRootComponent } from 'expo';

// import App from './App';

// // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// // It also ensures that whether you load the app in Expo Go or in a native build,
// // the environment is set up appropriately
// registerRootComponent(App);
const LibLoader = async () => import('@onekeyfe/cardano-coin-selection-asmjs');

const getCardanoApi = async () => {
    const Loader = await LibLoader();
    return {
      composeTxPlan: Loader.onekeyUtils.composeTxPlan,
      signTransaction: Loader.onekeyUtils.signTransaction,
      hwSignTransaction: Loader.trezorUtils.signTransaction,
      txToOneKey: Loader.onekeyUtils.txToOneKey,
      dAppUtils: Loader.dAppUtils,
    };
  };

  getCardanoApi()