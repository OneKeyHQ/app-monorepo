import { cloneDeep } from 'lodash';

import type { WalletService } from '@onekeyhq/kit/src/components/WalletConnect/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { IWalletConnectSession } from '@walletconnect/types';

export type IExternalAccountInfoWalletImage = {
  sm: string;
  md: string;
  lg: string;
};
export type IExternalAccountType =
  | 'walletConnect'
  | 'injectedProvider' // only in Web
  | 'offlineSigner';
export type IBaseExternalAccountInfo = {
  type?: IExternalAccountType;
  walletUrl: string;
  walletName: string;
  walletImg?: IExternalAccountInfoWalletImage;
};
type ISimpleDbWalletConnectSessionInfo = {
  session: IWalletConnectSession | undefined;
  updatedAt: number;
  walletServiceId?: string;
  walletServiceName?: string;

  accountInfo?: IBaseExternalAccountInfo;
  walletService?: WalletService;
};
export type ISimpleDbEntityWalletConnectData = {
  // { walletServiceId: {} }
  walletServices: Partial<{
    [walletServiceId: string]: WalletService;
  }>;

  // { dappUrl: { session } }
  dapps: Partial<{
    [dappUrl: string]: ISimpleDbWalletConnectSessionInfo;
  }>;

  // { walletUrl: { session, walletServiceId, updatedAt } }
  wallets: Partial<{
    [walletUrl: string]: ISimpleDbWalletConnectSessionInfo;
  }>;

  // { externalAccountId: { walletUrl } }
  externalAccounts: Partial<{
    [externalAccountId: string]: IBaseExternalAccountInfo;
  }>;
};

const dataDefaults: ISimpleDbEntityWalletConnectData = {
  walletServices: {},
  dapps: {},
  wallets: {},
  externalAccounts: {},
};

export class SimpleDbEntityWalletConnect extends SimpleDbEntityBase<ISimpleDbEntityWalletConnectData> {
  entityName = 'walletConnect';

  async getRawDataWithDefault(): Promise<ISimpleDbEntityWalletConnectData> {
    return (await this.getRawData()) ?? cloneDeep(dataDefaults);
  }

  async clearExternalAccountSessions() {
    await this.setRawData(cloneDeep(dataDefaults));
  }

  walletServiceCache: Partial<{
    [urlAndName: string]: WalletService | undefined;
  }> = {};

  async findWalletServiceBySession({
    session,
  }: {
    session: IWalletConnectSession;
  }): Promise<WalletService | undefined> {
    if (session.peerMeta && session) {
      const { url, name } = session.peerMeta;
      const cacheKey = `${url}-${name}`;
      if (this.walletServiceCache[cacheKey]) {
        return this.walletServiceCache[cacheKey];
      }
      const rawData = await this.getRawDataWithDefault();
      const walletService = this._getWalletServiceByUrlOrName({
        walletName: name,
        walletUrl: url,
        rawData,
      });
      if (walletService && cacheKey) {
        this.walletServiceCache[cacheKey] = walletService;
      }
      return walletService;
    }
    return undefined;
  }

  _getWalletServiceByUrlOrName({
    walletName,
    walletUrl,
    rawData,
  }: {
    walletName?: string;
    walletUrl?: string;
    rawData: ISimpleDbEntityWalletConnectData;
  }): WalletService | undefined {
    let walletService: WalletService | undefined;
    const walletServicesList = Object.values(rawData.walletServices);

    // *** try to find walletUrl matched
    walletService = walletServicesList.find((item) => {
      try {
        if (
          item?.homepage &&
          walletUrl &&
          new URL(walletUrl).hostname &&
          new URL(item?.homepage).hostname === new URL(walletUrl).hostname
        ) {
          return true;
        }
      } catch (err) {
        debugLogger.common.error(err);
      }
      return false;
    });

    // *** try to find walletName matched
    if (!walletService) {
      // eslint-disable-next-line no-param-reassign
      walletService = walletServicesList.find(
        (item) => item?.name === walletName && walletName,
      );
    }

    return walletService;
  }

  getBaseExternalAccountInfoFromWalletService({
    walletService,
  }: {
    walletService: WalletService;
  }): IBaseExternalAccountInfo {
    return {
      walletUrl: walletService.homepage,
      walletName: walletService.name,
      walletImg: walletService.image_url,
    };
  }

  _getWalletImage({
    walletService,
    walletName,
    walletUrl,
    session,
    rawData,
  }: {
    walletName?: string;
    walletUrl?: string;
    walletService?: WalletService;
    session?: IWalletConnectSession;
    rawData: ISimpleDbEntityWalletConnectData;
  }) {
    let img: IExternalAccountInfoWalletImage | undefined;

    if (!walletService) {
      // eslint-disable-next-line no-param-reassign
      walletService = this._getWalletServiceByUrlOrName({
        walletUrl,
        walletName,
        rawData,
      });
    }

    if (walletService) {
      img = walletService?.image_url || img;
    }

    const sessionPeerIcon = session?.peerMeta?.icons?.[0];
    if (!img && sessionPeerIcon) {
      img = {
        sm: sessionPeerIcon,
        md: sessionPeerIcon,
        lg: sessionPeerIcon,
      };
    }

    return img;
  }

  async saveExternalAccountInfo({
    accountId,
    accountInfo,
  }: {
    accountId: string;
    accountInfo: IBaseExternalAccountInfo;
  }) {
    const data = await this.getRawDataWithDefault();
    data.externalAccounts[accountId] = accountInfo;
    await this.setRawData(data);
  }

  async saveWalletConnectSessionOfAccount({
    accountId,
    session,
    walletService,
  }: {
    accountId: string;
    session: IWalletConnectSession;
    walletService?: WalletService;
  }) {
    const data = await this.getRawDataWithDefault();
    let walletServiceId = walletService?.id;
    if (walletService && walletServiceId) {
      data.walletServices[walletServiceId] = walletService;
    }
    const peerWalletUrl = session.peerMeta?.url;
    if (peerWalletUrl) {
      const walletName = session.peerMeta?.name || '';
      const walletUrl = peerWalletUrl;
      if (!walletServiceId) {
        // eslint-disable-next-line no-param-reassign
        walletService = this._getWalletServiceByUrlOrName({
          walletUrl,
          walletName,
          rawData: data,
        });
        debugLogger.walletConnect.info('getWalletServiceByUrlOrName', {
          walletUrl,
          walletName,
          result: {
            homepage: walletService?.homepage,
          },
        });
        walletServiceId = walletService?.id ?? walletServiceId;
      }
      data.wallets[peerWalletUrl] = {
        session,
        updatedAt: Date.now(),
        walletServiceId,
        walletServiceName: walletService?.name || '',
      };

      const walletImg = this._getWalletImage({
        walletService,
        walletName,
        walletUrl,
        session,
        rawData: data,
      });
      data.externalAccounts[accountId] = {
        type: 'walletConnect',
        walletUrl,
        walletName,
        walletImg,
      };
    }

    await this.setRawData(data);
  }

  async getWalletServicesList(): Promise<WalletService[]> {
    const data = await this.getRawDataWithDefault();
    const list = Object.values(data.walletServices).filter(Boolean);
    if (list.length) {
      return list;
    }
    return [];
  }

  async saveWalletServicesList(list: WalletService[]) {
    const data = await this.getRawDataWithDefault();
    if (list && list.length) {
      const walletServicesMap: Partial<{
        [walletServiceId: string]: WalletService;
      }> = {};
      list.forEach((item) => {
        walletServicesMap[item.id] = item;
      });

      // lodash merge new data
      // data.walletServices = merge(data.walletServices, walletServicesMap);

      // replace all data
      data.walletServices = walletServicesMap;
      await this.setRawData(data);
    }
  }

  async getExternalAccountImage({ accountId }: { accountId: string }) {
    const { accountInfo, walletService } =
      await this.getWalletConnectSessionOfAccount({
        accountId,
      });
    if (accountInfo?.walletImg) {
      return accountInfo?.walletImg;
    }
    const data = await this.getRawDataWithDefault();
    const walletImg = this._getWalletImage({
      walletService,
      walletUrl: accountInfo?.walletUrl,
      walletName: accountInfo?.walletName,
      rawData: data,
    });
    if (walletImg) {
      const accInfo = data.externalAccounts[accountId];
      if (accInfo && !accInfo?.walletImg) {
        accInfo.walletImg = walletImg;
        await this.setRawData(data);
      }
    }
    return walletImg;
  }

  async getWalletConnectSessionOfAccount({
    accountId,
  }: {
    accountId: string;
  }): Promise<ISimpleDbWalletConnectSessionInfo> {
    const data = await this.getRawDataWithDefault();

    const accountInfo = data.externalAccounts[accountId];
    const walletUrl = accountInfo?.walletUrl;
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

    let walletName =
      accountInfo?.walletName ||
      session?.peerMeta?.name ||
      walletService?.name ||
      '';
    walletName = walletName.replace('🌈 ', '');
    if (accountInfo) {
      accountInfo.walletName = walletName;
    }

    return {
      accountInfo,
      session,
      updatedAt,
      walletServiceId,
      walletService,
    };
  }

  async _mockSessionConnected(walletUrl: string, connected: boolean) {
    const data = await this.getRawDataWithDefault();
    const wallet = data.wallets[walletUrl];
    if (wallet && wallet.session) {
      wallet.session.connected = connected;
      await this.setRawData(data);
    }
  }

  async removeWalletSession(walletUrl: string | undefined) {
    const data = await this.getRawDataWithDefault();
    if (walletUrl) {
      const wallet = data.wallets[walletUrl];
      if (wallet) {
        wallet.session = undefined;
        await this.setRawData(data);
      }
    }
  }

  async removeAccount({ accountId }: { accountId: string }) {
    // TODO disconnect wallet app connections
    // TODO check if indexedDb external accounts empty and clear simpleDB accounts
    const data = await this.getRawDataWithDefault();
    if (accountId) {
      delete data.externalAccounts[accountId];
      await this.setRawData(data);
    }
  }
}
