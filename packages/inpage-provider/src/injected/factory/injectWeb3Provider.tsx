import {
  IInpageProviderRequestPayload,
  IJsBridgeMessagePayload,
} from '../../types';

function injectWeb3Provider(): void {
  if (!window?.onekey?.jsBridge) {
    throw new Error('OneKey jsBridge not found.');
  }
  const bridge = window?.onekey?.jsBridge;
  const ethereum = {
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
    _updateAccounts(
      accounts: Array<string> = [],
      { triggerEvent = true } = {},
    ) {
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
      const res = (await bridge.request(req)) as { result: unknown };
      if (
        req.method === 'eth_accounts' ||
        req.method === 'eth_requestAccounts'
      ) {
        this._updateAccounts(res.result as Array<string>);
      }
      if (req.method === 'eth_chainId') {
        this._updateChainId(res.result as string);
      }
      console.log('ethereum response: \n', req, '\n   --->  ', res);
      return res;
    },
    async send(method: string, params: unknown, ...others: Array<unknown>) {
      const res = await this.request({
        method,
        params,
        others,
      } as IInpageProviderRequestPayload);
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

  bridge.on('message', (payload: IJsBridgeMessagePayload) => {
    console.log('ethereum onMessage', payload);
    const payloadData = payload.data as IInpageProviderRequestPayload;
    const { method } = payloadData;
    // baseProvider
    //   -> this._jsonRpcConnection.events.on('notification'
    if (method === 'metamask_chainChanged') {
      ethereum._updateChainId(
        (payloadData.params as { chainId: string }).chainId,
      );
    }
    if (method === 'metamask_accountsChanged') {
      ethereum._updateAccounts(payloadData.params as Array<string>);
    }
  });
  // TODO use metamask_getProviderState and DO NOT trigger changed events
  ethereum.request({ method: 'eth_chainId' } as IInpageProviderRequestPayload);
  ethereum.request({ method: 'eth_accounts' } as IInpageProviderRequestPayload);

  // TODO conflict with MetaMask
  window.onekey.ethereum = ethereum;
  window.ethereum = ethereum;
  window.web3 = ethereum;
}
export default injectWeb3Provider;
