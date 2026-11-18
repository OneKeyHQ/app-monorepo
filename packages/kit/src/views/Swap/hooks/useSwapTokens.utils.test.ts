import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ETokenRiskLevel } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildServerAuthoritativeSearchResults,
  findSwapWalletBalanceToken,
  isSwapSupportAllAccountsRequestCurrent,
  mergeSwapSearchTokenBalance,
  releaseSwapTokenListFetchEffectKey,
  shouldLoadSwapAllNetworkTokenList,
} from './useSwapTokens.utils';

describe('isSwapSupportAllAccountsRequestCurrent', () => {
  it('accepts the active request from the current cache generation', () => {
    expect(
      isSwapSupportAllAccountsRequestCurrent({
        isCancelled: false,
        requestGeneration: 2,
        currentGeneration: 2,
      }),
    ).toBe(true);
  });

  it('rejects cancelled and stale-generation requests', () => {
    expect(
      isSwapSupportAllAccountsRequestCurrent({
        isCancelled: true,
        requestGeneration: 2,
        currentGeneration: 2,
      }),
    ).toBe(false);
    expect(
      isSwapSupportAllAccountsRequestCurrent({
        isCancelled: false,
        requestGeneration: 1,
        currentGeneration: 2,
      }),
    ).toBe(false);
  });
});

describe('releaseSwapTokenListFetchEffectKey', () => {
  it('releases the active key so a cancelled request can restart', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-1',
      }),
    ).toBe('');
  });

  it('does not release a newer request', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-2',
      }),
    ).toBe('request-2');
  });
});

describe('buildServerAuthoritativeSearchResults', () => {
  it('keeps server-only alias matches while preserving local highlights', () => {
    const symbolMatchedToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDA',
      decimals: 18,
    } satisfies ISwapToken;
    const aliasMatchedToken = {
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      symbol: 'AAPLx',
      decimals: 18,
      subtitles: ['Apple', '苹果'],
    } satisfies ISwapToken;
    const matches: NonNullable<IFuseResult<ISwapToken>['matches']> = [
      { indices: [[0, 3]], key: 'symbol', value: 'NVDA' },
    ];

    expect(
      buildServerAuthoritativeSearchResults(
        [symbolMatchedToken, aliasMatchedToken],
        new Map([[symbolMatchedToken, matches]]),
      ),
    ).toEqual([
      { item: symbolMatchedToken, refIndex: 0, matches },
      { item: aliasMatchedToken, refIndex: 1 },
    ]);
  });

  it('returns an empty list for empty server results', () => {
    expect(buildServerAuthoritativeSearchResults([])).toEqual([]);
  });
});

describe('shouldLoadSwapAllNetworkTokenList', () => {
  const base = {
    networkId: 'onekeyall--0',
    keywords: '',
    isTokenFetchAllNetworks: true,
    allNetworkTokenListReady: true,
  };
  const address = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';

  it('reloads the list for every empty-keyword all-network fetch', () => {
    expect(shouldLoadSwapAllNetworkTokenList(base)).toBe(true);
  });

  it('refreshes the wallet list for an address search so balances are current', () => {
    expect(
      shouldLoadSwapAllNetworkTokenList({ ...base, keywords: address }),
    ).toBe(true);
  });

  it('reuses the list for name searches', () => {
    expect(
      shouldLoadSwapAllNetworkTokenList({ ...base, keywords: 'USDC' }),
    ).toBe(false);
  });

  it('always reloads after a balance-changing event', () => {
    expect(
      shouldLoadSwapAllNetworkTokenList({
        ...base,
        keywords: 'USDC',
        forceRefresh: true,
      }),
    ).toBe(true);
  });

  it('skips concrete-network fetches and lists that are not ready', () => {
    expect(
      shouldLoadSwapAllNetworkTokenList({
        ...base,
        networkId: 'evm--42161',
        isTokenFetchAllNetworks: false,
        keywords: address,
      }),
    ).toBe(false);
    expect(
      shouldLoadSwapAllNetworkTokenList({
        ...base,
        allNetworkTokenListReady: false,
        keywords: address,
      }),
    ).toBe(false);
  });
});

describe('mergeSwapSearchTokenBalance', () => {
  const searchToken = {
    networkId: 'evm--10',
    contractAddress: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    symbol: 'USDC',
    decimals: 6,
    price: '1.0001',
    riskLevel: ETokenRiskLevel.MALICIOUS,
  } as ISwapToken;
  const cachedToken = {
    ...searchToken,
    price: '0.99',
    riskLevel: undefined,
    balanceParsed: '0.975765',
    fiatValue: '0.98',
    accountAddress: '0xowner',
    networkLogoURI: 'https://logo/op.png',
  } as ISwapToken;

  it('keeps fresh metadata and only takes account-owned fields from the cache', () => {
    const merged = mergeSwapSearchTokenBalance(searchToken, cachedToken);
    expect(merged.riskLevel).toBe(ETokenRiskLevel.MALICIOUS);
    expect(merged.price).toBe('1.0001');
    expect(merged.balanceParsed).toBe('0.975765');
    // Cached balance priced with the fresh search price.
    expect(merged.fiatValue).toBe('0.9758625765');
    expect(merged.accountAddress).toBe('0xowner');
    expect(merged.networkLogoURI).toBe('https://logo/op.png');
  });

  it('keeps the cached fiat value when the search has no price', () => {
    const merged = mergeSwapSearchTokenBalance(
      { ...searchToken, price: undefined } as ISwapToken,
      cachedToken,
    );
    expect(merged.fiatValue).toBe('0.98');
  });
});

describe('findSwapWalletBalanceToken', () => {
  const walletToken = {
    networkId: 'evm--10',
    contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    decimals: 6,
    balanceParsed: '0.975765',
  } as ISwapToken;

  it('matches checksum and lowercase forms of the same contract', () => {
    expect(
      findSwapWalletBalanceToken([walletToken], {
        ...walletToken,
        contractAddress: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        balanceParsed: undefined,
      }),
    ).toBe(walletToken);
  });

  it('does not match the same contract on another network', () => {
    expect(
      findSwapWalletBalanceToken([walletToken], {
        ...walletToken,
        networkId: 'evm--42161',
      }),
    ).toBeUndefined();
  });
});
