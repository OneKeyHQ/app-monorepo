import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  IInjectedProviderNames,
  IJsonRpcRequest,
  IJsonRpcResponse,
} from '../types';

import ProviderBase, { IInpageProviderConfig } from './ProviderBase';

class ProviderEthereum extends ProviderBase {
  constructor(config: IInpageProviderConfig) {
    super(config);
    this.initProviderState();
  }

  protected providerName = IInjectedProviderNames.ethereum;

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
    this.request({ method: 'eth_chainId' } as IJsonRpcRequest);
    this.request({ method: 'eth_accounts' } as IJsonRpcRequest);

    // TODO move to internal or self provider.
    this.request({
      method: 'wallet_getDebugLoggerSettings',
    } as IJsonRpcRequest).then((res: IJsonRpcResponse) => {
      setTimeout(() => {
        debugLogger.debug?.enable(res.result);
      }, 200);
    });
  }

  _updateChainId(chainId: string, { triggerEvent = true } = {}) {
    if (this.chainId !== chainId) {
      this.chainId = chainId;
      this.networkVersion = `${parseInt(chainId, 16)}`;
      if (triggerEvent) {
        debugLogger.ethereum('event chainChanged', chainId);
        this.emit('chainChanged', chainId);
      }
    }
  }

  _updateAccounts(accounts: Array<string> = [], { triggerEvent = true } = {}) {
    const address = accounts[0] || '';
    if (address && address !== this.selectedAddress) {
      this.selectedAddress = address;
      if (triggerEvent) {
        debugLogger.ethereum('event accountsChanged', accounts);
        this.emit('accountsChanged', accounts);
      }
    }
  }

  async request(req: IJsonRpcRequest): Promise<IJsonRpcResponse> {
    // method: "eth_blockNumber", params: []
    // method: "eth_requestAccounts", params: []
    // method: "eth_accounts", params: []
    debugLogger.ethereum('request', req);
    const res = (await this.bridge.request({
      data: req ?? {},
      scope: this.providerName,
    })) as IJsonRpcResponse;
    if (req.method === 'eth_accounts' || req.method === 'eth_requestAccounts') {
      this._updateAccounts(res.result as Array<string>);
    }
    if (req.method === 'eth_chainId') {
      this._updateChainId(res.result as string);
    }
    debugLogger.ethereum('request->response', '\n', req, '\n ---> ', res);
    return res;
  }

  async send(method: string, params: unknown) {
    const res = await this.request({
      method,
      params,
    } as IJsonRpcRequest);
    return res;
  }
}

export default ProviderEthereum;
