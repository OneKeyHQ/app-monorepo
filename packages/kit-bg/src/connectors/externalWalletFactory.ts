import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import { ExternalControllerEvm } from './chains/evm/ExternalControllerEvm';
import { ExternalControllerWalletConnect } from './chains/walletconnect/ExternalControllerWalletConnect';

import type { ExternalControllerBase } from './base/ExternalControllerBase';
import type { IBackgroundApi } from '../apis/IBackgroundApi';

export class ExternalWalletFactory {
  backgroundApi?: IBackgroundApi;

  setBackgroundApi(backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  controllersCache: Record<string, ExternalControllerBase> = {};

  getWalletConnectController() {
    if (!this.backgroundApi) {
      throw new Error('ExternalWalletFactory backgroundApi not set yet');
    }
    const implWalletConnect = 'walletconnect';
    if (!this.controllersCache[implWalletConnect]) {
      this.controllersCache[implWalletConnect] =
        new ExternalControllerWalletConnect({
          backgroundApi: this.backgroundApi,
          factory: this,
        });
    }
    return this.controllersCache[implWalletConnect];
  }

  async getController({
    impl,
    networkId,
    connectionInfo,
  }: {
    impl?: string;
    networkId?: string;
    connectionInfo?: IExternalConnectionInfo;
  }): Promise<ExternalControllerBase> {
    if (!this.backgroundApi) {
      throw new Error('ExternalWalletFactory backgroundApi not set yet');
    }
    // eslint-disable-next-line no-param-reassign
    impl = impl || networkUtils.getNetworkImpl({ networkId: networkId || '' });

    if (!impl && !connectionInfo) {
      throw new Error(
        'ExternalWalletFactory->getController ERROR:  No impl or connectionInfo',
      );
    }

    if (
      impl === IMPL_EVM ||
      connectionInfo?.evmEIP6963 ||
      connectionInfo?.evmInjected
    ) {
      if (!this.controllersCache[IMPL_EVM]) {
        this.controllersCache[IMPL_EVM] = new ExternalControllerEvm({
          backgroundApi: this.backgroundApi,
          factory: this,
        });
      }
      return this.controllersCache[IMPL_EVM];
    }
    if (connectionInfo?.walletConnect) {
      return this.getWalletConnectController();
    }
    throw new Error(
      `ExternalWalletFactory->getController ERROR:  Unknown impl or connectionInfo: ${
        impl || ''
      }`,
    );
  }
}

export default new ExternalWalletFactory();
