import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { ExternalControllerEvm } from './chains/evm/ExternalControllerEvm';
import { ExternalControllerWalletConnect } from './chains/walletconnect/ExternalControllerWalletConnect';

import type { ExternalControllerBase } from './base/ExternalControllerBase';
import type { IBackgroundApi } from '../apis/IBackgroundApi';

class ExternalWalletFactory {
  backgroundApi?: IBackgroundApi;

  setBackgroundApi(backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  controllersCache: Record<string, ExternalControllerBase> = {};

  async getController({
    impl,
    connectionInfo,
  }: {
    impl?: string;
    connectionInfo?: IExternalConnectionInfo;
  }): Promise<ExternalControllerBase> {
    if (!impl && !connectionInfo) {
      throw new Error(
        'ExternalWalletFactory->getController ERROR:  No impl or connectionInfo',
      );
    }
    if (!this.backgroundApi) {
      throw new Error('ExternalWalletFactory backgroundApi not set yet');
    }
    if (
      impl === IMPL_EVM ||
      connectionInfo?.evmEIP6963 ||
      connectionInfo?.evmInjected
    ) {
      if (!this.controllersCache[IMPL_EVM]) {
        this.controllersCache[IMPL_EVM] = new ExternalControllerEvm({
          backgroundApi: this.backgroundApi,
        });
      }
      return this.controllersCache[IMPL_EVM];
    }
    if (connectionInfo?.walletConnect) {
      const implWalletConnect = 'walletconnect';
      if (!this.controllersCache[implWalletConnect]) {
        this.controllersCache[implWalletConnect] =
          new ExternalControllerWalletConnect({
            backgroundApi: this.backgroundApi,
          });
      }
      return this.controllersCache[implWalletConnect];
    }
    throw new Error(
      `ExternalWalletFactory->getController ERROR:  Unknown impl or connectionInfo: ${
        impl || ''
      }`,
    );
  }
}

export default new ExternalWalletFactory();
