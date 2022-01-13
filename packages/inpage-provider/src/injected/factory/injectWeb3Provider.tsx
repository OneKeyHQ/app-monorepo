/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import JsBridgeBase from '../../jsBridge/JsBridgeBase';
import ProviderEthereum from '../../provider/ProviderEthereum';
import ProviderPrivate from '../../provider/ProviderPrivate';

export type WindowOneKeyHub = {
  debugLogger?: any;
  jsBridge?: JsBridgeBase;
  ethereum?: ProviderEthereum;
  $private?: ProviderPrivate;
};

function injectWeb3Provider() {
  if (!window?.$onekey?.jsBridge) {
    throw new Error('OneKey jsBridge not found.');
  }
  const bridge: JsBridgeBase = window?.$onekey?.jsBridge;

  const ethereum = new ProviderEthereum({
    bridge,
  });
  const $private = new ProviderPrivate({
    bridge,
  });

  // providerHub
  const $onekey = {
    ...window.$onekey,
    jsBridge: bridge,
    ethereum,
    $private,
    solana: null,
    conflux: null,
    sollet: null,
  };
  window.$onekey = $onekey;
  // TODO conflict with MetaMask
  window.ethereum = ethereum;
  // window.web3 = ethereum; // dapp create web3.js or ethers.js itself

  // TODO use initializeInpageProvider.ts
  window.dispatchEvent(new Event('ethereum#initialized'));

  return $onekey;
}
export default injectWeb3Provider;
