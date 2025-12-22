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
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
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
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
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

  private getAccountPriority(accountId?: string): number {
    if (!accountId) return 1;
    const accountParams = { accountId };
    if (
      accountUtils.isHdAccount(accountParams) ||
      accountUtils.isHwAccount(accountParams) ||
      accountUtils.isQrAccount(accountParams) ||
      accountUtils.isImportedAccount(accountParams)
    ) {
      return 0; // Internal accounts first (HD/HW/QR/Imported)
    }
    return 1; // Others accounts (Watching/External)
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
    aggregateTokenListCacheMap,
  }: {
    input: string;
    networkId?: string;
    accountId?: string;
    indexedAccountId?: string;
    searchTypes: EUniversalSearchType[];
    tokenListCache?: IAccountToken[];
    tokenListCacheMap?: Record<string, ITokenFiat>;
    aggregateTokenListCacheMap?: Record<string, { tokens: IAccountToken[] }>;
  }): Promise<IUniversalSearchBatchResult> {
    const result: IUniversalSearchBatchResult = {};
    const promiseResults = await Promise.allSettled([
      searchTypes.includes(EUniversalSearchType.Address)
        ? this.universalSearchOfAddress({ input, networkId })
        : Promise.resolve([]),
      searchTypes.includes(EUniversalSearchType.V2MarketToken)
        ? this.universalSearchOfV2MarketToken(input)
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
            aggregateTokenListCacheMap,
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
      v2MarketTokenResultSettled,
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
      v2MarketTokenResultSettled.status === 'fulfilled' &&
      v2MarketTokenResultSettled.value &&
      v2MarketTokenResultSettled.value.length > 0
    ) {
      result[EUniversalSearchType.V2MarketToken] = {
        items: v2MarketTokenResultSettled.value.map((item) => ({
          type: EUniversalSearchType.V2MarketToken,
          payload: item,
        })),
      };
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

  @backgroundMethod()
  async universalSearchOfV2MarketToken(query: string) {
    return this.backgroundApi.serviceMarket.searchV2Token(query);
  }

  async universalSearchOfAccountAssets({
    input,
    networkId,
    accountId,
    indexedAccountId,
    tokenListCache,
    tokenListCacheMap,
    aggregateTokenListCacheMap,
  }: {
    input: string;
    networkId: string;
    accountId: string;
    indexedAccountId: string;
    tokenListCache?: IAccountToken[];
    tokenListCacheMap?: Record<string, ITokenFiat>;
    aggregateTokenListCacheMap?: Record<string, { tokens: IAccountToken[] }>;
  }) {
    if (tokenListCache && tokenListCacheMap) {
      return {
        tokens: sortTokensByFiatValue({
          tokens: getFilteredTokenBySearchKey({
            tokens: tokenListCache,
            searchKey: input,
            allowEmptyWhenBelowMinLength: true,
            aggregateTokenListMap: aggregateTokenListCacheMap,
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
          indexedAccountId,
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
            aggregateTokenListMap: aggregateTokenListCacheMap,
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
            indexedAccountId,
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
        indexedAccountId,
      });

      tokens = r.allTokens?.data ?? [];
      tokenMap = r.allTokens?.map ?? ({} as Record<string, ITokenFiat>);
    }

    return {
      tokens: sortTokensByFiatValue({
        tokens: getFilteredTokenBySearchKey({
          tokens,
          searchKey: input,
          aggregateTokenListMap: aggregateTokenListCacheMap,
        }),
        map: tokenMap,
      }),
      tokenMap,
    };
  }

  private getUniversalValidateNetworkIds = memoizee(
    async ({ networkId }: { networkId?: string }) => {
      const { serviceNetwork } = this.backgroundApi;
      const { networks } = await serviceNetwork.getAllNetworks();
      let isEvmAddressChecked = false;
      const items: string[] = [];

      if (networkId && networkUtils.isEvmNetwork({ networkId })) {
        isEvmAddressChecked = true;
        items.push(networkId);
      }

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

    // Always search for account names regardless of address validation
    const accountNameSearchPromise = this.searchAccountsByName({
      searchTerm: trimmedInput,
      networkId,
    });

    // Step 1: Get supported networks and batch validate
    const networkIdList = await this.getUniversalValidateNetworkIds({
      networkId,
    });
    const batchValidateResult =
      await serviceValidator.serverBatchValidateAddress({
        networkIdList,
        accountAddress: trimmedInput,
      });

    // Execute account name search in parallel
    const accountNameResults = await accountNameSearchPromise;

    if (!batchValidateResult.isValid) {
      // If address validation fails, return only account name search results
      return accountNameResults;
    }

    let addressSearchItems: IUniversalSearchResultItem[] = [];

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
          addressSearchItems.push(...internalItems);
          console.log(
            '[universalSearchOfAddress] internalItems from network',
            validNetworkId,
            ':',
            internalItems,
          );
        }
      }
    }

    // Step 3: If no internal accounts found, search for external addresses
    if (addressSearchItems.length === 0) {
      const externalAddressResults = await this.findExternalAddresses({
        input: trimmedInput,
        networkId,
        batchValidateResult,
      });
      addressSearchItems = externalAddressResults.items;
      console.log('[universalSearchOfAddress] externalItems: ', {
        items: addressSearchItems,
      });
    }

    // Step 4: Merge results with address search results having priority
    const mergedItems = [
      ...addressSearchItems, // Address search results first (higher priority)
      ...accountNameResults.items, // Account name search results second
    ];

    console.log('[universalSearchOfAddress] mergedItems: ', mergedItems);

    return { items: mergedItems } as IUniversalSearchSingleResult;
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
    const sortedAccounts = sortBy(walletAccountItems, (item) =>
      this.getAccountPriority(item.accountId),
    );

    // Get network info
    const network = await serviceNetwork.getNetworkSafe({
      networkId: networkId || '',
    });
    if (!network) {
      return items;
    }

    const deFiRawData =
      (await this.backgroundApi.simpleDb.deFi.getRawData()) ?? undefined;

    // Create search result items
    for (const accountItem of sortedAccounts) {
      let account;
      let indexedAccount;
      let wallet;
      let accountsValue;
      let accountsDeFiOverview;
      try {
        accountsDeFiOverview = (
          await this.backgroundApi.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: accountItem.accountId,
                networkId: networkId || '',
                accountAddress: address,
              },
            ],
            deFiRawData,
          })
        )?.[0];
        if (
          accountUtils.isOthersAccount({
            accountId: accountItem.accountId,
          })
        ) {
          account = await serviceAccount.getAccount({
            accountId: accountItem.accountId,
            networkId: networkId || '',
          });
          if (account?.id) {
            accountsValue = (
              await this.backgroundApi.serviceAccountProfile.getAccountsValue({
                accounts: [{ accountId: account?.id }],
              })
            )?.[0];
          }
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
          if (account?.id) {
            accountsValue = (
              await this.backgroundApi.serviceAccountProfile.getAllNetworkAccountsValue(
                {
                  accounts: [{ accountId: indexedAccount.id }],
                },
              )
            )?.[0];
          }
        }

        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId: accountItem.accountId,
        });
        wallet = await serviceAccount.getWalletSafe({
          walletId,
        });
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
          accountsDeFiOverview,
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
    batchValidateResult: { networkIds: string[] };
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

  @backgroundMethod()
  async searchUrlAccount({
    input,
    networkId,
  }: {
    input: string;
    networkId?: string;
  }): Promise<IUniversalSearchSingleResult> {
    const { serviceValidator } = this.backgroundApi;
    const trimmedInput = input.trim();

    // Step 1: Get supported networks and batch validate
    const networkIdList = await this.getUniversalValidateNetworkIds({
      networkId,
    });
    const batchValidateResult =
      await serviceValidator.serverBatchValidateAddress({
        networkIdList,
        accountAddress: trimmedInput,
      });

    if (!batchValidateResult.isValid) {
      return { items: [] } as IUniversalSearchSingleResult;
    }

    // Step 2: Only search for external addresses
    const externalAddressResults = await this.findExternalAddresses({
      input: trimmedInput,
      networkId,
      batchValidateResult,
    });

    console.log('[searchUrlAccount] externalItems: ', {
      items: externalAddressResults.items,
    });

    return externalAddressResults;
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
          item.payload.network?.impl === currentImpl
        ) {
          item.payload.network = currentNetwork;
          return 0;
        }
      }
      return 1;
    });
  }

  private async searchAccountsByName({
    searchTerm,
    networkId,
  }: {
    searchTerm: string;
    networkId?: string;
  }): Promise<IUniversalSearchSingleResult> {
    const {
      serviceAccount,
      serviceNetwork,
      serviceAccountProfile,
      serviceValidator,
    } = this.backgroundApi;

    if (!searchTerm.trim()) {
      return { items: [] } as IUniversalSearchSingleResult;
    }

    const threshold = 0.3;
    const maxResults = 20;
    const includeScore = true;
    const includeMatches = true;
    const shouldSort = true;
    const minMatchCharLength = 3;

    // search indexed accounts
    const { indexedAccounts } = await serviceAccount.getAllIndexedAccounts({
      filterRemoved: true,
    });
    const indexedAccountsFuse = buildFuse(indexedAccounts, {
      keys: ['name'],
      threshold,
      includeScore,
      includeMatches,
      minMatchCharLength,
      shouldSort,
    });
    const indexedAccountsSearchResult = indexedAccountsFuse.search(searchTerm);
    const indexedAccountsResults = indexedAccountsSearchResult
      .slice(0, maxResults)
      .map(async (i) => {
        try {
          const wallet = await serviceAccount.getWalletSafe({
            walletId: i.item.walletId,
          });
          const accountsValue = (
            await serviceAccountProfile.getAllNetworkAccountsValue({
              accounts: [{ accountId: i.item.id }],
            })
          )?.[0];

          let account: INetworkAccount | undefined;
          let addressInfo: IAddressValidation | undefined;

          if (networkId && !networkUtils.isAllNetwork({ networkId })) {
            const deriveType =
              await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId,
                },
              );
            account = await this.backgroundApi.serviceAccount.getNetworkAccount(
              {
                accountId: undefined,
                indexedAccountId: i.item.id,
                networkId,
                deriveType,
              },
            );

            if (account) {
              addressInfo =
                await this.backgroundApi.serviceValidator.localValidateAddress({
                  networkId,
                  address: account.address,
                });
            }
          }

          return {
            wallet,
            indexedAccount: i.item,
            accountsValue,
            accountInfo: {
              accountId: i.item.id,
              formattedName: `${wallet?.name || ''} / ${i.item.name}`,
              accountName: i.item.name,
            },
            score: i.score,
            network: undefined,
            account,
            addressInfo,
          };
        } catch (e) {
          console.error('Failed to get indexed account data:', e);
          return null;
        }
      });

    // search other accounts
    const { accounts } = await serviceAccount.getAllAccounts({
      filterRemoved: true,
    });
    const otherAccounts = accounts.filter((account) =>
      accountUtils.isOthersAccount({ accountId: account.id }),
    );
    const otherAccountsFuse = buildFuse(otherAccounts, {
      keys: ['name'],
      threshold,
      includeScore,
      includeMatches,
      minMatchCharLength,
      shouldSort,
    });
    const otherAccountsSearchResult = otherAccountsFuse.search(searchTerm);
    const otherAccountsResults = otherAccountsSearchResult
      .slice(0, maxResults)
      .map(async (i) => {
        try {
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: i.item.id,
          });
          const wallet = await serviceAccount.getWalletSafe({
            walletId,
          });
          const network = await serviceNetwork.getNetworkSafe({
            networkId: i.item.createAtNetwork,
          });
          let account = i.item;
          if (!account.address && network?.id) {
            account = await serviceAccount.getAccount({
              accountId: i.item.id,
              networkId: network.id,
            });
          }
          const accountsValue = (
            await serviceAccountProfile.getAccountsValue({
              accounts: [{ accountId: i.item.id }],
            })
          )?.[0];
          const localValidateResult =
            await serviceValidator.localValidateAddress({
              networkId: i.item.createAtNetwork ?? '',
              address: i.item.address,
            });
          return {
            wallet,
            network,
            account,
            accountsValue,
            addressInfo: localValidateResult,
            accountInfo: {
              accountId: i.item.id,
              formattedName: `${wallet?.name || ''} / ${i.item.name}`,
              accountName: i.item.name,
            },
            score: i.score,
            indexedAccount: undefined,
          };
        } catch (e) {
          console.error('Failed to get other account data:', e);
          return null;
        }
      });

    const allResults = [
      ...(await Promise.all(indexedAccountsResults)),
      ...(await Promise.all(otherAccountsResults)),
    ]
      .filter(Boolean)
      // First sort by account type (HD/HW/QR/Imported first, then others)
      .sort((a, b) => {
        const aAccountId = a?.account?.id || a?.indexedAccount?.id;
        const bAccountId = b?.account?.id || b?.indexedAccount?.id;
        const aPriority = this.getAccountPriority(aAccountId);
        const bPriority = this.getAccountPriority(bAccountId);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Then sort by account value
        const aValue = Number(a?.accountsValue?.value) || 0;
        const bValue = Number(b?.accountsValue?.value) || 0;
        if (aValue !== bValue) {
          return bValue - aValue;
        }

        // Finally sort by search score
        const aScore = a?.score ?? 0;
        const bScore = b?.score ?? 0;
        return bScore - aScore;
      })
      .slice(0, maxResults);

    // Format results as IUniversalSearchAddress items
    const items = allResults.map((result) => {
      return {
        type: EUniversalSearchType.Address,
        payload: {
          wallet: result.wallet,
          account: result.account,
          indexedAccount: result.indexedAccount,
          network: result.network,
          addressInfo: result.addressInfo,
          accountInfo: result.accountInfo,
          accountsValue: result.accountsValue,
          isSearchedByAccountName: true,
        },
      };
    });

    console.log('[searchAccountsByName] items: ', items);

    return { items } as IUniversalSearchSingleResult;
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
      ...otherResults,
      ...(googleSearchDapp ? [googleSearchDapp] : []),
    ];
    const items = allDapps.map((dapp) => ({
      type: EUniversalSearchType.Dapp as const,
      payload: dapp,
    }));

    return { items };
  }
}

export default ServiceUniversalSearch;
