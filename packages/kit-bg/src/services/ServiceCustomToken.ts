import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  ECustomTokenStatus,
  type IAccountToken,
  type ICloudSyncCustomToken,
} from '@onekeyhq/shared/types/token';

import { type IDBCloudSyncItem } from '../dbs/local/types';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IAllNetworkAccountsParamsForApi } from './ServiceAllNetwork/ServiceAllNetwork';
import type { ICustomTokenDBStruct } from '../dbs/simple/entity/SimpleDbEntityCustomTokens';

@backgroundClass()
class ServiceCustomToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async buildCustomTokenSyncItems({
    customTokens,
    isDeleted,
  }: {
    customTokens: ICloudSyncCustomToken[];
    isDeleted: boolean;
  }) {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        customTokens.map(async (customToken) => {
          return syncManagers.customToken.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: customToken,
            dataTime: now,
            isDeleted,
          });
        }),
      )
    ).filter(Boolean);
    return syncItems;
  }

  async withCustomTokenCloudSync({
    fn,
    customTokens,
    isDeleted,
    skipSaveLocalSyncItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    skipEventEmit,
  }: {
    fn: () => Promise<void>;
    customTokens: ICloudSyncCustomToken[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildCustomTokenSyncItems({
        customTokens,
        isDeleted,
      });
    }
    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn,
    });
  }

  @backgroundMethod()
  public async addCustomToken({
    token,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    token: ICloudSyncCustomToken;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.addCustomTokenBatch({
      tokens: [token],
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async addCustomTokenBatch({
    tokens,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    tokens: ICloudSyncCustomToken[];
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.withCustomTokenCloudSync({
      fn: () =>
        this.backgroundApi.simpleDb.customTokens.addCustomTokensBatch({
          tokens,
        }),
      customTokens: [...tokens].map((item) => {
        const newItem: ICloudSyncCustomToken = {
          ...item,
        };
        newItem.tokenStatus = ECustomTokenStatus.Custom;
        return newItem;
      }),
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async hideToken({
    token,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    token: ICloudSyncCustomToken;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.withCustomTokenCloudSync({
      fn: () =>
        this.backgroundApi.simpleDb.customTokens.hideToken({
          token,
        }),
      customTokens: [token].map((item) => {
        const newItem: ICloudSyncCustomToken = {
          ...item,
        };
        newItem.tokenStatus = ECustomTokenStatus.Hidden;
        return newItem;
      }),
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
    });
  }

  @backgroundMethod()
  public async getCustomTokens({
    accountXpubOrAddress,
    accountId,
    networkId,
    customTokensRawData,
  }: {
    accountXpubOrAddress?: string | null;
    accountId: string;
    networkId: string;
    customTokensRawData?: ICustomTokenDBStruct;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getCustomTokens({
      accountXpubOrAddress,
      accountId,
      networkId,
      customTokensRawData,
    });
  }

  @backgroundMethod()
  public async getHiddenTokens({
    accountXpubOrAddress,
    accountId,
    networkId,
    customTokensRawData,
  }: {
    accountXpubOrAddress?: string | null;
    accountId: string;
    networkId: string;
    customTokensRawData?: ICustomTokenDBStruct;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getHiddenTokens({
      accountXpubOrAddress,
      accountId,
      networkId,
      customTokensRawData,
    });
  }

  async getAllCustomTokensByStatus(
    tokenStatusMap: 'customMap' | 'hiddenMap',
  ): Promise<ICloudSyncCustomToken[]> {
    const data = await this.backgroundApi.simpleDb.customTokens.getRawData();
    const tokens: ICloudSyncCustomToken[] = [];
    const tokensMap = data?.tokens || {};
    const customMap = data?.[tokenStatusMap] || {};
    Object.entries(customMap).forEach(([accountKey, tokenMap]) => {
      Object.entries(tokenMap).forEach(([tokenKey]) => {
        const token = tokensMap[tokenKey];
        const accountXpubOrAddress =
          this.backgroundApi.simpleDb.customTokens.getXpubOrAddressFromAccountKey(
            accountKey,
          );
        if (token && accountXpubOrAddress) {
          const tokenStatus =
            tokenStatusMap === 'hiddenMap'
              ? ECustomTokenStatus.Hidden
              : ECustomTokenStatus.Custom;
          tokens.push({
            ...token,
            accountXpubOrAddress,
            tokenStatus,
          });
        }
      });
    });
    return tokens;
  }

  @backgroundMethod()
  async getAllCustomTokens(): Promise<ICloudSyncCustomToken[]> {
    return this.getAllCustomTokensByStatus('customMap');
  }

  async getAllHiddenTokens(): Promise<ICloudSyncCustomToken[]> {
    return this.getAllCustomTokensByStatus('hiddenMap');
  }

  @backgroundMethod()
  async searchTokenByKeywords({
    walletId,
    accountId,
    networkId,
    keywords,
  }: {
    walletId: string;
    accountId: string;
    networkId: string;
    keywords: string;
  }) {
    if (!keywords) {
      return [];
    }
    let allNetworkAccounts: IAllNetworkAccountsParamsForApi[] | undefined;
    if (networkUtils.isAllNetwork({ networkId })) {
      const { allNetworkAccounts: allNetworkAccountsWithAccountId } =
        await this.backgroundApi.serviceAllNetwork.buildAllNetworkAccountsForApiParam(
          {
            accountId,
            networkId,
            excludeIncompatibleWithWalletAccounts: true,
          },
        );
      allNetworkAccounts = allNetworkAccountsWithAccountId.map((i) => ({
        networkId: i.networkId,
        accountAddress: i.accountAddress,
        xpub: i.accountXpub,
      }));
    }
    return this._searchTokens({
      walletId,
      networkId,
      searchParams: { keywords, allNetworkAccounts },
    });
  }

  @backgroundMethod()
  async searchTokenByContractAddress({
    walletId,
    networkId,
    contractAddress,
    isNative,
  }: {
    walletId: string;
    networkId: string;
    contractAddress: string;
    isNative: boolean;
  }) {
    if (!contractAddress && !isNative) {
      return [];
    }
    return this._searchTokens({
      walletId,
      networkId,
      searchParams: { contractList: [contractAddress] },
    });
  }

  @backgroundMethod()
  async _searchTokens({
    walletId,
    networkId,
    searchParams,
  }: {
    walletId: string;
    networkId: string;
    searchParams: {
      keywords?: string;
      contractList?: string[];
      allNetworkAccounts?: IAllNetworkAccountsParamsForApi[];
    };
  }) {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const response = await vault.fetchTokenDetails({
      walletId,
      networkId,
      ...searchParams,
    });
    return response.data.data ?? [];
  }

  @backgroundMethod()
  @toastIfError()
  async activateToken({
    accountId,
    networkId,
    token,
  }: {
    accountId: string;
    networkId: string;
    token: IAccountToken;
  }): Promise<boolean> {
    const vaultSetting =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    if (!vaultSetting.activateTokenRequired) return true;
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    return vault.activateToken({
      token,
    });
  }
}

export default ServiceCustomToken;
