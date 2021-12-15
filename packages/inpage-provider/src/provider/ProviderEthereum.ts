import ProviderBase, { IInpageProviderConfig } from './ProviderBase';
import { IInpageProviderRequestData } from '../types';

class ProviderEthereum extends ProviderBase {
  constructor(config: IInpageProviderConfig) {
    super(config);
    this.initProviderState();
  }

  public isMetaMask = true;

  public isOneKey = true;

  public chainId = '';

  public networkVersion = '';

  public selectedAddress = '';

  isConnected() {
    return true;
  }

  // @ts-ignore
  off() {
    // TODO remove this
  }

  // @ts-ignore
  removeAllListeners() {
    // TODO remove this
  }

  // @ts-ignore
  removeListener() {
    // TODO remove this
  }

  initProviderState() {
    // TODO use metamask_getProviderState and DO NOT trigger changed events
    this.request({ method: 'eth_chainId' } as IInpageProviderRequestData);
    this.request({ method: 'eth_accounts' } as IInpageProviderRequestData);
  }

  _updateChainId(chainId: string, { triggerEvent = true } = {}) {
    if (this.chainId !== chainId) {
      this.chainId = chainId;
      this.networkVersion = `${parseInt(chainId, 16)}`;
      if (triggerEvent) {
        console.log('event chainChanged', chainId);
        this.emit('chainChanged', chainId);
      }
    }
  }

  _updateAccounts(accounts: Array<string> = [], { triggerEvent = true } = {}) {
    const address = accounts[0] || '';
    if (address && address !== this.selectedAddress) {
      this.selectedAddress = address;
      if (triggerEvent) {
        console.log('event accountsChanged', accounts);
        this.emit('accountsChanged', accounts);
      }
    }
  }

  async request(req: IInpageProviderRequestData) {
    // method: "eth_blockNumber", params: []
    // method: "eth_requestAccounts", params: []
    // method: "eth_accounts", params: []
    console.log('ethereum.request', req);
    const res = (await this.bridge.request({ data: req })) as {
      result: unknown;
    };
    if (req.method === 'eth_accounts' || req.method === 'eth_requestAccounts') {
      this._updateAccounts(res.result as Array<string>);
    }
    if (req.method === 'eth_chainId') {
      this._updateChainId(res.result as string);
    }
    console.log('ethereum response: \n', req, '\n   --->  ', res);
    return res;
  }

  async send(method: string, params: unknown) {
    const res = await this.request({
      method,
      params,
    } as IInpageProviderRequestData);
    return res;
  }
}

export default ProviderEthereum;
