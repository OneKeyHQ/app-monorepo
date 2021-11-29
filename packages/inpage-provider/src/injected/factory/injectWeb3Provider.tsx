import { IInpageProviderRequestPayload } from '../../types';

function injectWeb3Provider(): void {
  if (!window?.onekey?.jsBridge) {
    throw new Error('OneKey jsBridge not found.');
  }
  const bridge = window?.onekey?.jsBridge;
  window.onekey.ethereum = {
    isMetaMask: true,
    isOneKey: true,
    chainId: '',
    networkVersion: '',
    selectedAddress: '',
    isConnected() {
      return true;
    },
    _updateChainId(chainId: string, { triggerEvent = true } = {}) {
      if (this.chainId !== chainId) {
        this.chainId = chainId;
        this.networkVersion = `${parseInt(chainId, 16)}`;
        if (triggerEvent) {
          bridge.trigger('chainChanged', chainId);
        }
      }
    },
    _updateAccounts(accounts = [], { triggerEvent = true } = {}) {
      const address = accounts[0] || '';
      if (address !== this.selectedAddress) {
        this.selectedAddress = address;
        if (triggerEvent) {
          bridge.trigger('accountsChanged', accounts);
        }
      }
    },
    async request(req: IInpageProviderRequestPayload) {
      // method: "eth_blockNumber", params: []
      // method: "eth_requestAccounts", params: []
      // method: "eth_accounts", params: []
      console.log('ethereum.request', req);
      const res = await bridge.request(req);
      if (
        req.method === 'eth_accounts' ||
        req.method === 'eth_requestAccounts'
      ) {
        this._updateAccounts(res.result);
      }
      if (req.method === 'eth_chainId') {
        this._updateChainId(res.result);
      }
      console.log('ethereum response: \n', req, '\n   --->  ', res);
      return res;
    },
    async send(method: string, params: any, ...others: Array<any>) {
      const res = await this.request({
        method,
        params,
        others,
      });
      return res;
    },
    on(eventName: string, handler: () => void) {
      // chainChanged
      // accountsChanged
      // close
      // networkChanged
      console.log('ethereum.on', eventName, handler);
      bridge.on(eventName, handler);
    },
  };
  bridge.on('message', (payload) => {
    console.log('ethereum onMessage', payload);
    const { method } = payload.data;
    // baseProvider
    //   -> this._jsonRpcConnection.events.on('notification'
    if (method === 'metamask_chainChanged') {
      window.onekey.ethereum._updateChainId(payload.data.params.chainId);
    }
    if (method === 'metamask_accountsChanged') {
      window.onekey.ethereum._updateAccounts(payload.data.params);
    }
  });
  // TODO use metamask_getProviderState and DO NOT trigger changed events
  window.onekey.ethereum.request({ method: 'eth_chainId' });
  window.onekey.ethereum.request({ method: 'eth_accounts' });

  // TODO conflict with MetaMask
  window.ethereum = window.onekey.ethereum;
  window.web3 = window.ethereum;
}
export default injectWeb3Provider;
