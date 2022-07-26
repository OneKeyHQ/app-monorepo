import { WalletService } from '@walletconnect/react-native-dapp';
import { cloneDeep } from 'lodash';

import { Account } from '../../../types/account';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { IWalletConnectSession } from '@walletconnect/types';

type ISimpleDbWalletConnectSessionInfo = {
  session: IWalletConnectSession | undefined;
  updatedAt: number;
  walletServiceId?: string;
  walletService?: WalletService;
};
export type ISimpleDbEntityWalletConnectData = {
  // { walletServiceId: {} }
  walletServices: Partial<Record<string, WalletService>>;

  // { dappOrigin: { session } }
  dapps: Partial<Record<string, ISimpleDbWalletConnectSessionInfo>>;

  // { walletUrl: { session, walletServiceId, updatedAt } }
  wallets: Partial<Record<string, ISimpleDbWalletConnectSessionInfo>>;

  // { externalAccountId: { walletUrl } }
  externalAccounts: Partial<
    Record<string, { walletUrl: string; walletName: string }>
  >;
};

const dataDefaults: ISimpleDbEntityWalletConnectData = {
  walletServices: {},
  dapps: {},
  wallets: {},
  externalAccounts: {}, // TODO remove to externalAccounts
};

export class SimpleDbEntityWalletConnect extends SimpleDbEntityBase<ISimpleDbEntityWalletConnectData> {
  entityName = 'walletConnect';

  async getRawDataWithDefault(): Promise<ISimpleDbEntityWalletConnectData> {
    return (await this.getRawData()) ?? cloneDeep(dataDefaults);
  }

  async clearExternalAccountSessions() {
    await this.setRawData(dataDefaults);
  }

  async saveExternalAccountSession({
    accountId,
    session,
    walletService,
  }: {
    accountId: string;
    session: IWalletConnectSession;
    walletService?: WalletService;
  }) {
    const data = await this.getRawDataWithDefault();
    const walletServiceId = walletService?.id;
    if (walletService && walletServiceId) {
      data.walletServices[walletServiceId] = walletService;
    }
    const peerWalletUrl = session.peerMeta?.url;
    if (peerWalletUrl) {
      data.wallets[peerWalletUrl] = {
        session,
        updatedAt: Date.now(),
        walletServiceId,
      };
      data.externalAccounts[accountId] = {
        walletUrl: peerWalletUrl,
        walletName: session.peerMeta?.name || '',
      };
    }

    await this.setRawData(data);
  }

  async getExternalAccountSession({
    accountId,
  }: {
    accountId: string;
  }): Promise<ISimpleDbWalletConnectSessionInfo> {
    const data = await this.getRawDataWithDefault();

    const walletUrl = data.externalAccounts[accountId]?.walletUrl;
    let session: IWalletConnectSession | undefined;
    let walletServiceId: string | undefined;
    let walletService: WalletService | undefined;
    let updatedAt = 0;
    if (walletUrl) {
      const sessionInfo = data.wallets[walletUrl];
      updatedAt = sessionInfo?.updatedAt || 0;
      walletServiceId = sessionInfo?.walletServiceId;
      session = sessionInfo?.session;
      if (walletServiceId) {
        walletService = data.walletServices[walletServiceId];
      }
    }

    return {
      session,
      updatedAt,
      walletServiceId,
      walletService,
    };
  }
}
