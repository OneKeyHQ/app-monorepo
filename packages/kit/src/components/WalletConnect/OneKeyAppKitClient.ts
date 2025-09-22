import { PACKAGE_VERSION } from '@reown/appkit/constants';
import { AppKit } from '@reown/appkit/core';
import {
  ConnectionController,
  CoreHelperUtil,
} from '@reown/appkit-controllers';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { WALLET_CONNECT_CLIENT_META } from '@onekeyhq/shared/src/walletConnect/constant';
import type { IWalletConnectUniversalProvider } from '@onekeyhq/shared/src/walletConnect/types';

import type { CreateAppKit } from '@reown/appkit/core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class OneKeyAppKit extends AppKit {
  override async initChainAdapter() {
    console.log('mocked initChainAdapter');
  }

  override async createUniversalProviderForAdapter() {
    console.log('mocked createUniversalProviderForAdapter');
  }

  // syncWalletConnectAccount
  override async syncWalletConnectAccount() {
    console.log('mocked syncWalletConnectAccount');
  }

  // initializeUniversalAdapter
  override async initializeUniversalAdapter() {
    console.log('mocked initializeUniversalAdapter');
  }

  override async createUniversalProvider() {
    console.log('mocked createUniversalProvider');
  }

  override async getUniversalProvider() {
    console.log('mocked getUniversalProvider');
    return undefined;
  }

  override createClients() {
    super.createClients();
    this.connectionControllerClient = {
      ...this.connectionControllerClient,
      connectWalletConnect: () => {
        console.log('mocked connectWalletConnect');
        return Promise.resolve();
      },
    } as any;
    ConnectionController.setClient(this.connectionControllerClient as any);
  }
}

export function createOneKeyAppKit(options: CreateAppKit) {
  //   const AppKitCls = OneKeyAppKit;
  const AppKitCls = AppKit;
  const metadata = WALLET_CONNECT_CLIENT_META;
  return new AppKitCls({
    ...options,
    universalProvider: {
      on() {
        throw new OneKeyLocalError(
          'ReownAppKit built-in universalProvider is disabled. Background WalletConnectDappSideProvider is already active.',
        );
      },
    } as unknown as IWalletConnectUniversalProvider,
    // node_modules/@reown/appkit/dist/esm/src/client/appkit-base-client.js getDefaultMetaData()
    metadata,
    sdkVersion: CoreHelperUtil.generateSdkVersion(
      options.adapters ?? [],
      'html',
      PACKAGE_VERSION,
    ),
  });
}
