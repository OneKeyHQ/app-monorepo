import { keyBy, merge } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Cap for the global token-metadata map (`data`, keyed by networkId_tokenAddress).
// It is merge-only and not per-account, so it can't be orphan-filtered; instead we
// bound it. Entries are pure cache (re-fetched on miss), so dropping the oldest is
// safe. 5000 covers any realistic multi-chain wallet's working set.
const LOCAL_TOKENS_METADATA_MAX_ENTRIES = 5000;

export interface ISimpleDBLocalTokens {
  data: Record<string, IToken>; // <networkId_tokenIdOnNetwork, token>
  tokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  smallBalanceTokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  riskyTokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  tokenListMap: Record<string, Record<string, ITokenFiat>>; // <networkId_accountAddress/xpub, Record<string, ITokenFiat>>
  tokenListValue: Record<string, string>; // <networkId_accountAddress/xpub, string>
  // Per-key currency tag for tokenListMap / tokenListValue. Missing keys are
  // pre-migration entries in the user's then-active display currency;
  // ServiceToken supplies the lazy fallback.
  tokenListCurrency?: Record<string, string>;
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ISimpleDBLocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  // Bound the global token-metadata map. Applied on every write (here, on read it
  // re-fetches on miss) so growth is capped regardless of whether the periodic
  // orphan sweep runs. Object key order is insertion order, so the oldest entries
  // are at the front; keep the most recent LOCAL_TOKENS_METADATA_MAX_ENTRIES.
  private capTokenMetadata(
    data: Record<string, IToken> | undefined,
  ): Record<string, IToken> {
    const map = data ?? {};
    const entries = Object.entries(map);
    if (entries.length <= LOCAL_TOKENS_METADATA_MAX_ENTRIES) {
      return map;
    }
    return Object.fromEntries(
      entries.slice(entries.length - LOCAL_TOKENS_METADATA_MAX_ENTRIES),
    );
  }

  @backgroundMethod()
  async updateTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    const tokenMap = keyBy(
      tokens.map((token) => ({
        ...token,
        '$key': accountUtils.buildLocalTokenId({
          networkId,
          tokenIdOnNetwork: token.address,
        }),
      })),
      '$key',
    );
    await this.setRawData((rawData) => ({
      data: this.capTokenMetadata(merge({}, rawData?.data, tokenMap)),
      tokenList: rawData?.tokenList ?? {},
      smallBalanceTokenList: rawData?.smallBalanceTokenList ?? {},
      riskyTokenList: rawData?.riskyTokenList ?? {},
      tokenListMap: rawData?.tokenListMap ?? {},
      tokenListValue: rawData?.tokenListValue ?? {},
      tokenListCurrency: rawData?.tokenListCurrency ?? {},
    }));
  }

  @backgroundMethod()
  async getToken({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const tokenId = accountUtils.buildLocalTokenId({
      networkId,
      tokenIdOnNetwork,
    });
    const tokenMap = (await this.getRawData())?.data;
    if (tokenMap) {
      const token = tokenMap[tokenId];
      if (token) {
        return token;
      }
    }
  }

  @backgroundMethod()
  async getTokens({
    networkId,
    tokenIdOnNetworkList,
  }: {
    networkId: string;
    tokenIdOnNetworkList: string[];
  }) {
    const tokenMap = (await this.getRawData())?.data;
    if (!tokenMap) {
      return [];
    }

    return tokenIdOnNetworkList
      .map((tokenIdOnNetwork) => {
        const tokenId = accountUtils.buildLocalTokenId({
          networkId,
          tokenIdOnNetwork,
        });
        return tokenMap[tokenId];
      })
      .filter((token): token is IToken => !!token);
  }

  @backgroundMethod()
  async searchTokens(params: { keywords: string }): Promise<IToken[]> {
    const rawData = await this.getRawData();
    const tokenMap = rawData?.data;

    if (!tokenMap) {
      return [];
    }

    const tokens = Object.values(tokenMap);
    const fuse = buildFuse(tokens, {
      keys: ['address'],
    });
    const result = fuse.search(params.keywords).map((i) => i.item);
    return result;
  }

  @backgroundMethod()
  async updateAccountTokenList({
    networkId,
    accountAddress,
    xpub,
    tokenList,
    smallBalanceTokenList,
    riskyTokenList,
    tokenListMap,
    tokenListValue,
    currency,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue: string;
    currency: string;
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.simpleDB__updateAccountTokenList,
      params: {
        networkId,
        accountAddress,
        xpub,
      },
    });

    perf.markStart('buildAccountLocalAssetsKey');
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    perf.markEnd('buildAccountLocalAssetsKey');

    perf.markStart('setRawData');
    await this.setRawData((rawData) => ({
      data: rawData?.data ?? {},
      tokenList: {
        ...rawData?.tokenList,
        [key]: tokenList,
      },
      smallBalanceTokenList: {
        ...rawData?.smallBalanceTokenList,
        [key]: smallBalanceTokenList,
      },
      riskyTokenList: {
        ...rawData?.riskyTokenList,
        [key]: riskyTokenList,
      },
      tokenListMap: {
        ...rawData?.tokenListMap,
        [key]: tokenListMap,
      },
      tokenListValue: {
        ...rawData?.tokenListValue,
        [key]: tokenListValue,
      },
      tokenListCurrency: {
        ...rawData?.tokenListCurrency,
        [key]: currency,
      },
    }));
    perf.markEnd('setRawData');
    perf.done();
  }

  @backgroundMethod()
  async updateAccountTokenListByCache(tokenListCache: {
    tokenList: Record<string, IAccountToken[]>;
    smallBalanceTokenList: Record<string, IAccountToken[]>;
    riskyTokenList: Record<string, IAccountToken[]>;
    tokenListValue: Record<string, string>;
    tokenListMap: Record<string, Record<string, ITokenFiat>>;
    tokenListCurrency: Record<string, string>;
  }) {
    await this.setRawData((rawData) => ({
      data: rawData?.data ?? {},
      tokenList: {
        ...rawData?.tokenList,
        ...tokenListCache.tokenList,
      },
      smallBalanceTokenList: {
        ...rawData?.smallBalanceTokenList,
        ...tokenListCache.smallBalanceTokenList,
      },
      riskyTokenList: {
        ...rawData?.riskyTokenList,
        ...tokenListCache.riskyTokenList,
      },
      tokenListMap: {
        ...rawData?.tokenListMap,
        ...tokenListCache.tokenListMap,
      },
      tokenListValue: {
        ...rawData?.tokenListValue,
        ...tokenListCache.tokenListValue,
      },
      tokenListCurrency: {
        ...rawData?.tokenListCurrency,
        ...tokenListCache.tokenListCurrency,
      },
    }));
  }

  @backgroundMethod()
  async getAccountTokenList({
    networkId,
    accountAddress,
    xpub,
    simpleDbLocalTokensRawData,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    simpleDbLocalTokensRawData: ISimpleDBLocalTokens | null | undefined;
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.simpleDB__getAccountTokenList,
      params: {
        networkId,
        accountAddress,
        xpub,
      },
    });

    perf.markStart('buildAccountLocalAssetsKey');
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    perf.markEnd('buildAccountLocalAssetsKey');

    perf.markStart('getRawData', {
      networkId,
      accountAddress,
      rawDataExist: !!simpleDbLocalTokensRawData,
    });
    const rawData = simpleDbLocalTokensRawData ?? (await this.getRawData());
    perf.markEnd('getRawData');

    const result = {
      tokenList: rawData?.tokenList?.[key] ?? [],
      smallBalanceTokenList: rawData?.smallBalanceTokenList?.[key] ?? [],
      riskyTokenList: rawData?.riskyTokenList?.[key] ?? [],
      tokenListMap: rawData?.tokenListMap?.[key] ?? {},
      tokenListValue: rawData?.tokenListValue?.[key] ?? '0',
      hasCache: Object.prototype.hasOwnProperty.call(
        rawData?.tokenList ?? {},
        key,
      ),
      currency: rawData?.tokenListCurrency?.[key],
    };

    perf.done();

    return result;
  }

  @backgroundMethod()
  async clearTokens() {
    await this.setRawData({
      data: {},
      tokenList: {},
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: {},
      tokenListValue: {},
      tokenListCurrency: {},
    });
  }

  // Drop cached token lists belonging to deleted accounts and cap the global
  // token-metadata map. `validOwners` is the set of lowercased addresses/xpubs of
  // all surviving accounts. Pure-cache cleanup: anything wrongly dropped just
  // re-fetches on the next refresh. See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    const filterByOwner = <V>(
      map: Record<string, V> | undefined,
    ): Record<string, V> => {
      const result: Record<string, V> = {};
      for (const [key, value] of Object.entries(map ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          result[key] = value;
        }
      }
      return result;
    };
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot: a
      // concurrent clearRawData ("Clear cache" calls localTokens.clearRawData)
      // nulls the store, and `?? existing` would resurrect the cleared cache.
      const base = rawData;
      return {
        // `data` is global token metadata (networkId_tokenAddress), not per
        // account; it can't be orphan-filtered, so cap total entries instead.
        data: this.capTokenMetadata(base?.data),
        tokenList: filterByOwner(base?.tokenList),
        smallBalanceTokenList: filterByOwner(base?.smallBalanceTokenList),
        riskyTokenList: filterByOwner(base?.riskyTokenList),
        tokenListMap: filterByOwner(base?.tokenListMap),
        tokenListValue: filterByOwner(base?.tokenListValue),
        tokenListCurrency: filterByOwner(base?.tokenListCurrency),
      };
    });
  }
}
