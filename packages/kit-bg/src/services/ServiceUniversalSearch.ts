import { sortBy } from 'lodash';

import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  GOOGLE_LOGO_URL,
  SEARCH_ITEM_ID,
} from '@onekeyhq/shared/src/consts/discovery';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  getFilteredTokenBySearchKey,
  getMergedDeriveTokenData,
  sortTokensByFiatValue,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IUniversalSearchAddress,
  IUniversalSearchBatchResult,
  IUniversalSearchDappResult,
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceUniversalSearch extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async universalSearchRecommend({
    searchTypes,
  }: {
    searchTypes: EUniversalSearchType[];
  }): Promise<IUniversalSearchBatchResult> {
    const result: IUniversalSearchBatchResult = {};
    if (!searchTypes.length) {
      return [] as IUniversalSearchBatchResult;
    }
    if (searchTypes.includes(EUniversalSearchType.MarketToken)) {
      const items =
        await this.backgroundApi.serviceMarket.fetchSearchTrending();
      result[EUniversalSearchType.MarketToken] = {
        items: items.map((item) => ({
          type: EUniversalSearchType.MarketToken,
          payload: item,
        })),
      };
    }
    return result;
  }

  @backgroundMethod()
  async universalSearch({
    input,
    networkId,
    accountId,
    indexedAccountId,
    searchTypes,
    tokenListCache,
    tokenListCacheMap,
  }: {
    input: string;
    networkId?: string;
    accountId?: string;
    indexedAccountId?: string;
    searchTypes: EUniversalSearchType[];
    tokenListCache?: IAccountToken[];
    tokenListCacheMap?: Record<string, ITokenFiat>;
  }): Promise<IUniversalSearchBatchResult> {
    const result: IUniversalSearchBatchResult = {};
    const promiseResults = await Promise.allSettled([
      searchTypes.includes(EUniversalSearchType.Address)
        ? this.universalSearchOfAddress({ input, networkId })
        : Promise.resolve([]),
      searchTypes.includes(EUniversalSearchType.MarketToken)
        ? this.universalSearchOfMarketToken(input)
        : Promise.resolve([]),
      searchTypes.includes(EUniversalSearchType.AccountAssets) &&
      accountId &&
      networkId &&
      indexedAccountId
        ? this.universalSearchOfAccountAssets({
            input,
            networkId,
            accountId,
            indexedAccountId,
            tokenListCache,
            tokenListCacheMap,
          })
        : Promise.resolve({
            tokens: [],
            tokenMap: {} as Record<string, ITokenFiat>,
          }),
      searchTypes.includes(EUniversalSearchType.Dapp)
        ? this.universalSearchOfDapp({ input })
        : Promise.resolve({ items: [] }),
    ]);
    const [
      addressResultSettled,
      marketTokenResultSettled,
      accountAssetsResultSettled,
      dappResultSettled,
    ] = promiseResults;

    if (
      addressResultSettled.status === 'fulfilled' &&
      addressResultSettled.value &&
      'items' in addressResultSettled.value &&
      addressResultSettled.value.items.length > 0
    ) {
      result[EUniversalSearchType.Address] = addressResultSettled.value;
    }

    if (
      marketTokenResultSettled.status === 'fulfilled' &&
      marketTokenResultSettled.value &&
      marketTokenResultSettled.value.length > 0
    ) {
      result[EUniversalSearchType.MarketToken] = {
        items: marketTokenResultSettled.value.map((item) => ({
          type: EUniversalSearchType.MarketToken,
          payload: item,
        })),
      };
    }

    if (
      accountAssetsResultSettled.status === 'fulfilled' &&
      accountAssetsResultSettled.value &&
      accountAssetsResultSettled.value.tokens.length > 0 &&
      accountAssetsResultSettled.value.tokenMap
    ) {
      result[EUniversalSearchType.AccountAssets] = {
        items: accountAssetsResultSettled.value.tokens.map((token) => ({
          type: EUniversalSearchType.AccountAssets,
          payload: {
            token,
            tokenFiat:
              accountAssetsResultSettled.value.tokenMap[token.$key || ''],
          },
        })),
      };
    }

    if (
      dappResultSettled.status === 'fulfilled' &&
      dappResultSettled.value &&
      dappResultSettled.value.items.length > 0
    ) {
      result[EUniversalSearchType.Dapp] = dappResultSettled.value;
    }

    return result;
  }

  async universalSearchOfMarketToken(query: string) {
    return this.backgroundApi.serviceMarket.searchToken(query);
  }

  async universalSearchOfAccountAssets({
    input,
    networkId,
    accountId,
    indexedAccountId,
    tokenListCache,
    tokenListCacheMap,
  }: {
    input: string;
    networkId: string;
    accountId: string;
    indexedAccountId: string;
    tokenListCache?: IAccountToken[];
    tokenListCacheMap?: Record<string, ITokenFiat>;
  }) {
    if (tokenListCache && tokenListCacheMap) {
      return {
        tokens: sortTokensByFiatValue({
          tokens: getFilteredTokenBySearchKey({
            tokens: tokenListCache,
            searchKey: input,
          }),
          map: tokenListCacheMap,
        }),
        tokenMap: tokenListCacheMap,
      };
    }

    await this.backgroundApi.serviceToken.abortFetchAccountTokens();

    const isAllNetwork = networkUtils.isAllNetwork({ networkId });

    let tokens: IAccountToken[] = [];
    let tokenMap: Record<string, ITokenFiat> = {};

    if (isAllNetwork) {
      const customTokensRawData =
        (await this.backgroundApi.simpleDb.customTokens.getRawData()) ??
        undefined;
      const { accountsInfo } =
        await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
          accountId,
          networkId,
          deriveType: undefined,
          nftEnabledOnly: false,
          excludeTestNetwork: true,
          networksEnabledOnly: !accountUtils.isOthersAccount({
            accountId,
          }),
        });

      const allNetworks = accountsInfo;
      const requests = allNetworks.map((networkDataString) => {
        return this.backgroundApi.serviceToken.fetchAccountTokens({
          dbAccount: networkDataString.dbAccount,
          networkId: networkDataString.networkId,
          accountId: networkDataString.accountId,
          flag: 'universal-search',
          isAllNetworks: true,
          isManualRefresh: false,
          mergeTokens: true,
          allNetworksAccountId: accountId,
          allNetworksNetworkId: networkId,
          saveToLocal: true,
          customTokensRawData,
        });
      });

      try {
        const resp = (await promiseAllSettledEnhanced(requests)).filter(
          Boolean,
        );

        const { allTokenList, allTokenListMap } = getMergedDeriveTokenData({
          data: resp,
          mergeDeriveAssetsEnabled: true,
        });

        tokens = allTokenList.tokens;
        tokenMap = allTokenListMap;
      } catch (e) {
        console.error(e);
        await this.backgroundApi.serviceToken.abortFetchAccountTokens();
        return {
          tokens,
          tokenMap,
        };
      }

      return {
        tokens: sortTokensByFiatValue({
          tokens: getFilteredTokenBySearchKey({
            tokens,
            searchKey: input,
          }),
          map: tokenMap,
        }),
        tokenMap,
      };
    }

    const vaultSettings = await getVaultSettings({ networkId });
    if (vaultSettings.mergeDeriveAssetsEnabled) {
      const { networkAccounts } =
        await this.backgroundApi.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId,
            indexedAccountId,
            excludeEmptyAccount: true,
          },
        );

      const resp = await Promise.all(
        networkAccounts.map((networkAccount) =>
          this.backgroundApi.serviceToken.fetchAccountTokens({
            accountId: networkAccount.account?.id ?? '',
            mergeTokens: true,
            networkId,
            flag: 'universal-search',
            saveToLocal: true,
          }),
        ),
      );

      const { allTokenList, allTokenListMap } = getMergedDeriveTokenData({
        data: resp,
        mergeDeriveAssetsEnabled: true,
      });

      tokens = allTokenList.tokens;
      tokenMap = allTokenListMap;
    } else {
      const r = await this.backgroundApi.serviceToken.fetchAccountTokens({
        accountId,
        mergeTokens: true,
        networkId,
        flag: 'universal-search',
        saveToLocal: true,
      });

      tokens = r.allTokens?.data ?? [];
      tokenMap = r.allTokens?.map ?? ({} as Record<string, ITokenFiat>);
    }

    return {
      tokens: sortTokensByFiatValue({
        tokens: getFilteredTokenBySearchKey({
          tokens,
          searchKey: input,
        }),
        map: tokenMap,
      }),
      tokenMap,
    };
  }

  private getUniversalValidateNetworkIds = memoizee(
    async () => {
      const { serviceNetwork } = this.backgroundApi;
      const { networks } = await serviceNetwork.getAllNetworks();
      let isEvmAddressChecked = false;
      const items: string[] = [];
      for (const network of networks) {
        if (networkUtils.isLightningNetworkByNetworkId(network.id)) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (isEvmAddressChecked && network.impl === IMPL_EVM) {
          // eslint-disable-next-line no-continue
          continue;
        }
        items.push(network.id);

        // evm address check only once
        if (network.impl === IMPL_EVM) {
          isEvmAddressChecked = true;
        }
      }
      return items;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    },
  );

  async universalSearchOfAddress({
    input,
    networkId,
  }: {
    input: string;
    networkId?: string;
  }): Promise<IUniversalSearchSingleResult> {
    const { serviceValidator } = this.backgroundApi;
    const trimmedInput = input.trim();

    // Step 1: Get supported networks and batch validate
    const networkIdList = await this.getUniversalValidateNetworkIds();
    const batchValidateResult =
      await serviceValidator.serverBatchValidateAddress({
        networkIdList,
        accountAddress: trimmedInput,
      });

    if (!batchValidateResult.isValid) {
      return { items: [] } as IUniversalSearchSingleResult;
    }

    // Step 2: Check if address belongs to internal wallets for valid networks
    for (const validNetworkId of batchValidateResult.networkIds) {
      const localValidateResult = await serviceValidator.localValidateAddress({
        networkId: validNetworkId,
        address: trimmedInput,
      });

      if (localValidateResult.isValid) {
        const internalItems = await this.findInternalWalletAccounts({
          address: localValidateResult.displayAddress,
          networkId: validNetworkId,
        });

        if (internalItems.length > 0) {
          console.log(
            '[universalSearchOfAddress] internalItems: ',
            internalItems,
          );
          return { items: internalItems } as IUniversalSearchSingleResult;
        }
      }
    }

    // Step 3: If not internal account, proceed with external address search
    return this.findExternalAddresses({
      input: trimmedInput,
      networkId,
      batchValidateResult,
    });
  }

  private async findInternalWalletAccounts({
    address,
    networkId,
  }: {
    address: string;
    networkId?: string;
  }): Promise<IUniversalSearchResultItem[]> {
    const { serviceNetwork, serviceAccount } = this.backgroundApi;
    const items: IUniversalSearchResultItem[] = [];

    // Get all accounts with this address
    const walletAccountItems = await serviceAccount.getAccountNameFromAddress({
      networkId: networkId || '',
      address,
    });

    if (!walletAccountItems.length) {
      return items;
    }

    // Sort accounts by type (HD/HW first)
    const sortedAccounts = sortBy(walletAccountItems, (item) => {
      const accountParams = { accountId: item.accountId };
      if (
        accountUtils.isHdAccount(accountParams) ||
        accountUtils.isHwAccount(accountParams) ||
        accountUtils.isQrAccount(accountParams) ||
        accountUtils.isImportedAccount(accountParams)
      ) {
        return 0; // Prioritize HD/HW/QR/Imported accounts
      }
      return 1; // Watching/Others accounts
    });

    // Get network info
    const network = await serviceNetwork.getNetworkSafe({
      networkId: networkId || '',
    });
    if (!network) {
      return items;
    }

    // Create search result items
    for (const accountItem of sortedAccounts) {
      let account;
      let indexedAccount;
      let wallet;
      let accountsValue;
      try {
        if (
          accountUtils.isOthersAccount({
            accountId: accountItem.accountId,
          })
        ) {
          account = await serviceAccount.getAccount({
            accountId: accountItem.accountId,
            networkId: networkId || '',
          });
        } else {
          indexedAccount = await serviceAccount.getIndexedAccount({
            id: accountItem.accountId,
          });

          account = (
            await serviceAccount.getNetworkAccountsInSameIndexedAccountId({
              indexedAccountId: accountItem.accountId,
              networkIds: [networkId || ''],
            })
          )?.[0]?.account;
        }

        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId: accountItem.accountId,
        });
        wallet = await serviceAccount.getWalletSafe({
          walletId,
        });
        if (account?.id) {
          accountsValue = (
            await this.backgroundApi.serviceAccountProfile.getAccountsValue({
              accounts: [{ accountId: account?.id }],
            })
          )?.[0];
        }
      } catch (e) {
        console.error('Failed to get account or indexedAccount:', e);
        // if get account or indexedAccount failed, skip current account, continue to next
        // eslint-disable-next-line no-continue
        continue;
      }

      items.push({
        type: EUniversalSearchType.Address,
        payload: {
          addressInfo: {
            isValid: true,
            displayAddress: address,
            normalizedAddress: address,
            encoding: EAddressEncodings.P2PKH,
          },
          network,
          accountInfo: {
            accountId: accountItem.accountId,
            formattedName: `${accountItem.walletName} / ${accountItem.accountName}`,
          },
          wallet,
          account,
          indexedAccount,
          accountsValue,
        },
      } as IUniversalSearchResultItem);
    }

    return items;
  }

  private async findExternalAddresses({
    input,
    networkId,
    batchValidateResult,
  }: {
    input: string;
    networkId?: string;
    batchValidateResult: { networkIds: string[]; isValid: boolean };
  }): Promise<IUniversalSearchSingleResult> {
    const { serviceNetwork, serviceValidator } = this.backgroundApi;
    const items: IUniversalSearchResultItem[] = [];

    // Validate for each supported network
    for (const batchNetworkId of batchValidateResult.networkIds) {
      const settings = await getVaultSettings({ networkId: batchNetworkId });
      if (settings.watchingAccountEnabled) {
        const network = await serviceNetwork.getNetworkSafe({
          networkId: batchNetworkId,
        });
        const localValidateResult = await serviceValidator.localValidateAddress(
          {
            networkId: batchNetworkId,
            address: input,
          },
        );

        if (network && localValidateResult.isValid) {
          items.push({
            type: EUniversalSearchType.Address,
            payload: {
              addressInfo: localValidateResult,
              network,
            },
          } as IUniversalSearchResultItem);
        }
      }
    }

    // Sort results with current network priority
    const currentNetwork = await serviceNetwork.getNetworkSafe({
      networkId: networkId || '',
    });
    const sortedItems = this.sortAddressResults(items, currentNetwork);

    console.log('[universalSearchOfAddress] externalItems: ', {
      items: sortedItems,
    });

    return { items: sortedItems } as IUniversalSearchSingleResult;
  }

  private sortAddressResults(
    items: IUniversalSearchResultItem[],
    currentNetwork?: IServerNetwork,
  ): IUniversalSearchResultItem[] {
    return sortBy(items as IUniversalSearchAddress[], (item) => {
      if (currentNetwork?.id) {
        const currentImpl = networkUtils.getNetworkImpl({
          networkId: currentNetwork.id,
        });
        if (
          currentImpl === IMPL_EVM &&
          item.payload.network.impl === currentImpl
        ) {
          item.payload.network = currentNetwork;
          return 0;
        }
      }
      return 1;
    });
  }

  async universalSearchOfDapp({
    input,
  }: {
    input: string;
  }): Promise<IUniversalSearchDappResult> {
    const { serviceDiscovery } = this.backgroundApi;
    const searchResult = await serviceDiscovery.searchDApp(input);

    // Filter and process results similar to Discovery search
    const exactUrlResults =
      searchResult?.filter((item) => item.isExactUrl) || [];
    const otherResults = searchResult?.filter((item) => !item.isExactUrl) || [];

    // Add Google search item if there is input
    const googleSearchDapp = input.trim()
      ? {
          dappId: SEARCH_ITEM_ID,
          name: `${appLocale.intl.formatMessage({
            id: ETranslations.explore_search_placeholder,
          })} "${input}"`,
          url: '',
          logo: GOOGLE_LOGO_URL,
          description: '',
          networkIds: [],
          tags: [],
        }
      : null;

    // Format results into universal search format
    const allDapps = [
      ...exactUrlResults,
      ...(googleSearchDapp ? [googleSearchDapp] : []),
      ...otherResults,
    ];
    const items = allDapps.map((dapp) => ({
      type: EUniversalSearchType.Dapp as const,
      payload: dapp,
    }));

    return { items };
  }
}

export default ServiceUniversalSearch;
