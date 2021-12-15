import JsBridgeBase from '../../jsBridge/JsBridgeBase';
import ProviderEthereum from '../../provider/ProviderEthereum';

export type WindowOneKeyHub = {
  jsBridge?: JsBridgeBase;
  ethereum?: ProviderEthereum;
};

function injectWeb3Provider() {
  if (!window?.$onekey?.jsBridge) {
    throw new Error('OneKey jsBridge not found.');
  }
  const bridge: JsBridgeBase = window?.$onekey?.jsBridge;

  const ethereum = new ProviderEthereum({
    bridge,
  });

  // providerHub
  const $onekey = {
    jsBridge: bridge,
    ethereum,
    web3: ethereum,
    solana: null,
    conflux: null,
    sollet: null,
  };
  window.$onekey = $onekey;
  // TODO conflict with MetaMask
  window.ethereum = ethereum;
  window.web3 = ethereum;
  return $onekey;
}
export default injectWeb3Provider;
