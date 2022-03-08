/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import { BackgroundApiProxyBase } from './BackgroundApiProxyBase';
import { IBackgroundApi } from './IBackgroundApi';
import {
  PromiseContainerCallbackCreate,
  PromiseContainerReject,
  PromiseContainerResolve,
} from './PromiseContainer';

class BackgroundApiProxy
  extends BackgroundApiProxyBase
  implements IBackgroundApi
{
  // TODO add custom eslint rule to force method name match
  dispatchAction(action: any) {
    return this.callBackgroundSync('dispatchAction', action);
  }

  getStoreState(): Promise<any> {
    return this.callBackground('getStoreState');
  }

  changeAccounts(address: string): void {
    return this.callBackgroundSync('changeAccounts', address);
  }

  changeChain(chainId: string, networkVersion?: string): void {
    return this.callBackgroundSync('changeChain', chainId, networkVersion);
  }

  notifyAccountsChanged(): void {
    return this.callBackground('notifyAccountsChanged');
  }

  notifyChainChanged(): void {
    return this.callBackground('notifyChainChanged');
  }

  createPromiseCallback(params: PromiseContainerCallbackCreate): number {
    return this.callBackground('createPromiseCallback', params);
  }

  rejectPromiseCallback(params: PromiseContainerReject): void {
    return this.callBackground('rejectPromiseCallback', params);
  }

  resolvePromiseCallback(params: PromiseContainerResolve): void {
    return this.callBackground('resolvePromiseCallback', params);
  }
}

export default BackgroundApiProxy;
