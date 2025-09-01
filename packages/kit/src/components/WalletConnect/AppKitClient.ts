import { PACKAGE_VERSION } from '@reown/appkit/constants';
import { AppKit } from '@reown/appkit/core';
import {
  ConnectionController,
  CoreHelperUtil,
} from '@reown/appkit-controllers';

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
  return new AppKitCls({
    ...options,
    universalProvider: {} as any, // undefined,
    sdkVersion: CoreHelperUtil.generateSdkVersion(
      options.adapters ?? [],
      'html',
      PACKAGE_VERSION,
    ),
  });
}
