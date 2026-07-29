import type { IHomePopularTradingPayload } from '@onekeyhq/kit/src/views/Home/components/PopularTrading/types';
import type { IHomeDeFiLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistorySourceAdapter';
import { HOME_HISTORY_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistoryStoreModel';
import type { IHomeSpotLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/spot/homeSpotSourceAdapter';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTxType,
  type IAccountHistoryTx,
} from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import {
  buildMobileNativeHomeViewModelSections,
  resolveMobileNativeHomeActionLayout,
  resolveMobileNativeHomeActionRowHeight,
  resolveMobileNativeHomeBannerPresentation,
  resolveMobileNativeHomeBodySections,
} from './mobileNativeHomeViewModelAdapter';

const presentation = {
  labels: {
    addTokenInstruction: "Can't find your token?",
    addTokenLabel: 'Add token',
    approve: 'Approve',
    contract: 'Contract',
    earn: 'Earn',
    favoriteAdd: 'Add to favorites',
    favoriteRemove: 'Remove from favorites',
    hotMarkets: 'Hot Markets',
    loading: 'Loading',
    long: 'Long',
    lowValueAssets: 'Low-value assets',
    margin: 'Margin',
    market: 'Market',
    noData: 'No data',
    positions: 'Positions',
    receive: 'Receive',
    revokeApprove: (symbol: string) => `Revoke ${symbol}`,
    riskAssets: (count: number) => `${count} Collapsed risk assets`,
    send: 'Send',
    short: 'Short',
    showLess: 'Show less',
    showMore: 'Show more',
    statusFailed: 'Failed',
    statusPending: 'Pending',
    swap: 'Swap',
    tokens: 'Tokens',
    unableToLoad: 'Unable to load',
    unlimited: 'Unlimited',
    viewMore: 'View more',
  },
  locale: 'en-US',
};

describe('mobileNativeHomeViewModelAdapter', () => {
  it('shows funded actions before the final balance total settles', () => {
    expect(
      resolveMobileNativeHomeActionLayout({
        actionPresentationKind: 'funded',
      }),
    ).toBe('standard');
    expect(
      resolveMobileNativeHomeActionLayout({
        actionPresentationKind: 'zero',
      }),
    ).toBe('zeroBalance');
    expect(
      resolveMobileNativeHomeActionLayout({
        actionPresentationKind: 'loading',
      }),
    ).toBe('loading');
    expect(
      resolveMobileNativeHomeActionLayout({
        actionPresentationKind: 'hidden',
      }),
    ).toBe('standard');
  });

  it('keeps loading action geometry aligned with the funded row', () => {
    expect(
      resolveMobileNativeHomeActionRowHeight({
        actionLayout: 'loading',
        isBackupRequired: false,
      }),
    ).toBe(62);
    expect(
      resolveMobileNativeHomeActionRowHeight({
        actionLayout: 'standard',
        isBackupRequired: false,
      }),
    ).toBe(62);
    expect(
      resolveMobileNativeHomeActionRowHeight({
        actionLayout: 'zeroBalance',
        isBackupRequired: false,
      }),
    ).toBe(98);
    expect(
      resolveMobileNativeHomeActionRowHeight({
        actionLayout: 'loading',
        isBackupRequired: true,
      }),
    ).toBe(0);
  });

  it('keeps the banner loading until its display policy settles', () => {
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'pending',
        bannerResourceKind: 'loading',
        hasBannerContent: false,
      }),
    ).toBe('loading');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'eligible',
        bannerResourceKind: 'partial',
        hasBannerContent: false,
      }),
    ).toBe('loading');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'pending',
        bannerResourceKind: 'partial',
        hasBannerContent: true,
      }),
    ).toBe('loading');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'pending',
        bannerResourceKind: 'ready',
        hasBannerContent: false,
      }),
    ).toBe('loading');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'eligible',
        bannerResourceKind: 'ready',
        hasBannerContent: true,
      }),
    ).toBe('content');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'eligible',
        bannerResourceKind: 'ready',
        hasBannerContent: false,
      }),
    ).toBe('hidden');
    expect(
      resolveMobileNativeHomeBannerPresentation({
        bannerPolicyKind: 'hidden',
        bannerResourceKind: 'loading',
        hasBannerContent: false,
      }),
    ).toBe('hidden');
  });

  it('provides an empty state row as the backup prompt slot host', () => {
    expect(
      resolveMobileNativeHomeBodySections({
        bodyPresentationKind: 'backupPrompt',
        sections: [
          {
            id: 'assets',
            items: [
              {
                id: 'btc',
                renderer: 'asset',
                title: 'BTC',
              },
            ],
          },
        ],
        tabId: 'portfolio',
      }),
    ).toEqual([
      {
        id: 'portfolio-backup-state',
        items: [
          {
            id: 'portfolio-backup-state-item',
            displayHeight: 320,
            renderer: 'empty',
            title: '',
          },
        ],
      },
    ]);
  });

  it('maps semantic loading and hidden states without renderer-owned data', () => {
    expect(
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        payloads: {},
        sectionId: 'defi',
        semantic: { kind: 'loading', placeholder: 'defi' },
      }),
    ).toEqual([
      {
        id: 'defi-state',
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `defi-state-loading-${index}`,
          displayHeight: 68,
          renderer: 'loading',
          title: 'Loading',
        })),
      },
    ]);
    expect(
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        payloads: {},
        sectionId: 'defi',
        semantic: { kind: 'hidden', reason: 'notApplicable' },
      }),
    ).toEqual([]);
  });

  it('reserves the original Perps empty-state slot geometry', () => {
    expect(
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        payloads: {},
        sectionId: 'perps',
        semantic: { kind: 'empty', emptyState: 'perps' },
      }),
    ).toEqual([
      {
        id: 'perps-state',
        items: [
          {
            id: 'perps-state-item',
            displayHeight: 600,
            renderer: 'empty',
            title: 'No data',
          },
        ],
      },
    ]);
  });

  it('projects ready History without rows to the empty-state slot', () => {
    expect(
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        payloads: {},
        sectionId: 'history',
        semantic: {
          kind: 'ready',
          priority: 1,
          refresh: 'idle',
          rowIds: [],
        },
      }),
    ).toEqual([
      {
        id: 'history-state',
        items: [
          {
            id: 'history-state-item',
            displayHeight: 360,
            renderer: 'empty',
            title: 'No data',
          },
        ],
      },
    ]);
  });

  it('matches the legacy mobile DeFi separators between rows only', () => {
    const defiPayload = {
      currency: 'USD',
      overview: {
        netWorth: 3,
        totalDebt: 0,
        totalReward: 0,
        totalValue: 3,
      },
      protocolMap: {},
      protocols: [
        { networkId: 'evm--1', positions: [], protocol: 'aave' },
        { networkId: 'evm--1', positions: [], protocol: 'uniswap' },
      ],
      supportedActions: [],
    } as unknown as IHomeDeFiLegacyPayload;
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      payloads: { defi: defiPayload },
      sectionId: 'defi',
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'idle',
        rowIds: ['aave', 'uniswap'],
      },
    });

    expect(sections[0]?.items.map((item) => item.showDivider)).toEqual([
      true,
      false,
    ]);
  });

  it('maps ready sections only from their Store payload', () => {
    expect(
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        payloads: {},
        sectionId: 'portfolio',
        semantic: {
          kind: 'ready',
          rowIds: [],
          priority: 1,
          refresh: 'idle',
        },
      }),
    ).toEqual([{ id: 'portfolio-assets', items: [] }]);
  });

  it('replaces only portfolio asset rows with skeletons during a DeFi-token switch', () => {
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      marketSemantic: { kind: 'loading', placeholder: 'market' },
      payloads: {},
      portfolioAssetsLoading: true,
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: [],
        priority: 0,
        refresh: 'refreshing',
      },
    });

    expect(sections[0]).toEqual({
      id: 'portfolio-assets',
      items: Array.from({ length: 6 }, (_, index) => ({
        id: `portfolio-assets-loading-${index}`,
        displayHeight: 68,
        renderer: 'loading',
        title: 'Loading',
      })),
    });
    expect(
      sections
        .slice(1)
        .every((section) => !section.id.startsWith('portfolio-assets')),
    ).toBe(true);
    expect(sections[1]?.id).toBe('portfolio-market');
  });

  it('keeps the add-token footer before Show less when portfolio tokens are expanded', () => {
    const tokens = Array.from({ length: 7 }, (_, index) => ({
      $key: `token-${index}`,
      accountId: 'account-a',
      address: `0x${index}`,
      balanceParsed: '1',
      decimals: 18,
      isNative: index === 0,
      logoURI: `token-${index}.png`,
      name: `Token ${index}`,
      networkId: 'evm--1',
      symbol: `T${index}`,
    }));

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      expanded: {
        defi: false,
        portfolioAssets: true,
        portfolioDeFi: false,
      },
      payloads: {
        portfolio: {
          accountTokensValue: '1',
          accountTokensWorthCurrency: 'USD',
          aggregateTokenListMap: {},
          allAggregateTokenMap: {},
          displayIds: tokens.map((token) => token.$key),
          fundedIds: tokens.map((token) => token.$key),
          generation: 1,
          homeDefaultTokenMap: {},
          isAllNetworkEmptyAccount: false,
          isLpTokenSwitchLoading: false,
          mergeDeriveAddressData: false,
          networksMap: {},
          ownerKey: 'owner-a',
          riskMap: {},
          riskTokens: [],
          scopedLpTokenList: { keys: '', tokens: [] },
          scopedLpTokenListMap: {},
          scopedLpTokenListState: { initialized: true, isRefreshing: false },
          showLpTokenFilterSwitch: false,
          showLpTokensOnly: false,
          smallBalanceMap: {},
          smallBalanceTokens: [],
          tapTokenMap: {},
          tokenListMap: Object.fromEntries(
            tokens.map((token, index) => [
              token.$key,
              {
                balance: '1',
                balanceParsed: '1',
                fiatValue: String(10 - index),
                price: 1,
                price24h: 0,
              },
            ]),
          ),
          tokens,
        } as IHomeSpotLegacyPayload,
      },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: tokens.map((token) => token.$key),
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections.at(-2)).toMatchObject({
      id: 'portfolio-assets-add-token',
      items: [
        expect.objectContaining({
          buttonTitle: 'Add token',
          displayHeight: 52,
          renderer: 'addToken',
          title: "Can't find your token?",
        }),
      ],
    });
    expect(sections.at(-2)?.items[0]).not.toHaveProperty('showChevron');
    expect(sections.at(-1)).toMatchObject({
      id: 'portfolio-assets-toggle',
      items: [
        expect.objectContaining({ renderer: 'showMore', title: 'Show less' }),
      ],
    });
  });

  it('does not offer Add Token while the DeFi token filter is active', () => {
    const tokens = Array.from({ length: 7 }, (_, index) => ({
      $key: `lp-token-${index}`,
      accountId: 'account-a',
      address: `0x${index}`,
      balanceParsed: '1',
      decimals: 18,
      isNative: false,
      name: `LP Token ${index}`,
      networkId: 'evm--1',
      symbol: `LP${index}`,
    }));
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      expanded: {
        defi: false,
        portfolioAssets: true,
        portfolioDeFi: false,
      },
      payloads: {
        portfolio: {
          accountTokensValue: '7',
          accountTokensWorthCurrency: 'USD',
          displayIds: tokens.map((token) => token.$key),
          networksMap: {},
          showLpTokensOnly: true,
          tokenListMap: Object.fromEntries(
            tokens.map((token) => [
              token.$key,
              {
                balanceParsed: '1',
                currency: 'usd',
                fiatValue: '1',
                price: '1',
                price24h: '0',
              },
            ]),
          ),
          tokens,
        } as unknown as IHomeSpotLegacyPayload,
      },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: tokens.map((token) => token.$key),
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(
      sections.some((section) => section.id === 'portfolio-assets-add-token'),
    ).toBe(false);
    expect(sections.at(-1)).toMatchObject({
      id: 'portfolio-assets-toggle',
      items: [expect.objectContaining({ title: 'Show less' })],
    });
  });

  it('uses display order, user currency, privacy masking, and network-specific asset chrome', () => {
    const nativeToken = {
      $key: 'native',
      accountId: 'account-a',
      address: '',
      balanceParsed: '2',
      decimals: 18,
      isNative: true,
      name: 'Native',
      networkId: 'evm--1',
      symbol: 'NATIVE',
    };
    const otherToken = {
      ...nativeToken,
      $key: 'other',
      address: '0xother',
      isNative: false,
      name: 'Other',
      symbol: 'OTHER',
    };
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      fiatContext: {
        currencyMap: {
          eur: {
            id: 'eur',
            name: 'Euro',
            type: ['fiat'],
            unit: '€',
            value: '0.9',
          },
          usd: {
            id: 'usd',
            name: 'US Dollar',
            type: ['fiat'],
            unit: '$',
            value: '1',
          },
        },
        targetCurrencyId: 'eur',
        targetCurrencyUnit: '€',
      },
      hideValue: true,
      isAllNetworks: false,
      payloads: {
        portfolio: {
          accountTokensValue: '30',
          accountTokensWorthCurrency: 'usd',
          displayIds: ['other', 'native'],
          networksMap: {
            'evm--1': { id: 'evm--1', logoURI: 'network.png' },
          },
          showLpTokensOnly: false,
          tokenListMap: {
            native: {
              balanceParsed: '2',
              currency: 'usd',
              fiatValue: '20',
              price: '10',
              price24h: '1',
            },
            other: {
              balanceParsed: '1',
              currency: 'usd',
              fiatValue: '10',
              price: '10',
              price24h: '-1',
            },
          },
          tokens: [nativeToken, otherToken],
        } as unknown as IHomeSpotLegacyPayload,
      },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: ['other', 'native'],
        priority: 1,
        refresh: 'idle',
      },
    });
    const items = sections[0]?.items ?? [];

    expect(items.map((item) => item.title)).toEqual(['OTHER', 'NATIVE']);
    expect(items[0]).toMatchObject({
      badgeImageUrl: undefined,
      detail: '****',
      displayHeight: 60,
      subtitle: '€9.00',
      subtitleDetail: '-1.00%',
      value: '****',
    });
    expect(items[1]).toMatchObject({
      badgeImageUrl: undefined,
      titleAccessoryIcon: 'gas',
    });
  });

  it('keeps cached Portfolio rows display-only until live data arrives', () => {
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      payloads: {
        portfolio: {
          accountTokensWorthCurrency: 'USD',
          displayIds: ['eth'],
          networksMap: {},
          showLpTokensOnly: false,
          tokenListMap: {
            eth: {
              balanceParsed: '1',
              fiatValue: '1',
              price: '1',
              price24h: '0',
            },
          },
          tokens: [
            {
              $key: 'eth',
              accountId: 'account-a',
              address: '',
              decimals: 18,
              isNative: true,
              name: 'Ethereum',
              symbol: 'ETH',
            },
          ],
        } as unknown as IHomeSpotLegacyPayload,
      },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: ['eth'],
        priority: 0,
        refresh: 'refreshing',
      },
    });

    expect(sections[0]?.items[0]?.actionId).toBeUndefined();
  });

  it('keeps hidden assets out of token rows and exposes their entry rows', () => {
    const token = (key: string, symbol: string) => ({
      $key: key,
      accountId: 'account-a',
      address: `0x${key}`,
      balanceParsed: '1',
      decimals: 18,
      isNative: false,
      logoURI: `${key}.png`,
      name: symbol,
      networkId: 'evm--1',
      symbol,
    });
    const visible = token('visible', 'VISIBLE');
    const lowValue = token('low-value', 'LOW');
    const risk = token('risk', 'RISK');
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      expanded: {
        defi: false,
        portfolioAssets: true,
        portfolioDeFi: false,
      },
      payloads: {
        portfolio: {
          accountTokensValue: '4',
          accountTokensWorthCurrency: 'USD',
          aggregateTokenListMap: {},
          allAggregateTokenMap: {},
          blockedRiskTokenCount: 6,
          displayIds: [visible.$key, lowValue.$key],
          fundedIds: [visible.$key, lowValue.$key, risk.$key],
          generation: 1,
          homeDefaultTokenMap: {},
          isAllNetworkEmptyAccount: false,
          isLpTokenSwitchLoading: false,
          mergeDeriveAddressData: false,
          networksMap: {},
          ownerKey: 'owner-a',
          riskMap: {
            [risk.$key]: {
              balance: '1',
              balanceParsed: '1',
              fiatValue: '1',
              price: 1,
              price24h: 0,
            },
          },
          riskTokens: [risk],
          scopedLpTokenList: { keys: '', tokens: [] },
          scopedLpTokenListMap: {},
          scopedLpTokenListState: { initialized: true, isRefreshing: false },
          showLpTokenFilterSwitch: false,
          showLpTokensOnly: false,
          smallBalanceFiatValue: '2',
          smallBalanceMap: {
            [lowValue.$key]: {
              balance: '1',
              balanceParsed: '1',
              fiatValue: '2',
              price: 2,
              price24h: 0,
            },
          },
          smallBalanceTokens: [lowValue],
          tapTokenMap: {},
          tokenListMap: {
            [visible.$key]: {
              balance: '1',
              balanceParsed: '1',
              fiatValue: '4',
              price: 4,
              price24h: 0,
            },
          },
          tokens: [visible],
        } as IHomeSpotLegacyPayload,
      },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: [visible.$key, lowValue.$key],
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections[0]?.items.map((item) => item.title)).toEqual(['VISIBLE']);
    const hiddenAssetItems = sections.find(
      (section) => section.id === 'portfolio-assets-hidden-groups',
    )?.items;
    expect(hiddenAssetItems).toEqual([
      expect.objectContaining({
        actionId: 'home.native.portfolio.assets.openLowValueAssets',
        displayHeight: 56,
        leadingIcon: 'lowValue',
        title: '1 Low-value assets',
        titleAccessoryIcon: 'question',
        value: '$2.00',
      }),
      expect.objectContaining({
        actionId: 'home.native.portfolio.assets.openRiskAssets',
        displayHeight: 56,
        leadingIcon: 'risk',
        title: '6 Collapsed risk assets',
      }),
    ]);
    expect(hiddenAssetItems?.[0]).not.toHaveProperty('showChevron');
    expect(hiddenAssetItems?.[1]).not.toHaveProperty('showChevron');
    expect(hiddenAssetItems?.[1]).not.toHaveProperty('value');
  });

  it('keeps Market and Earn presentation data in the portfolio ViewModel', () => {
    const marketPayload: IHomePopularTradingPayload = {
      categories: [
        { id: 'favorites', name: 'Favorites', iconName: 'StarOutline' },
      ],
      earnRows: [
        {
          name: 'USD Coin',
          symbol: 'USDC',
          logoURI: 'usdc.png',
          protocols: [{ networkId: 'evm--1', provider: 'aave' }],
          aprWithoutFee: '3.5',
        } as IHomePopularTradingPayload['earnRows'][number],
      ],
      favoriteMode: 'favorites',
      perpsHotRows: [],
      prefetchCategoryIds: [],
      prefetchedRowsByRequestKey: {},
      resolvedCategoryId: 'favorites',
      rows: [
        {
          chainId: 'evm--1',
          contractAddress: '0xabc',
          isNative: false,
          symbol: 'ETH',
          name: 'Ethereum',
          logoUrl: 'eth.png',
          price: 2000,
          priceChange24h: 2,
          marketCap: 1_000_000,
          volume24h: 500_000,
        },
      ],
      selectedCategoryId: 'favorites',
      totalFavorites: 1,
      watchListContentKey: 'watchlist-a',
      watchListItems: [],
    };

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      marketSemantic: {
        kind: 'ready',
        rowIds: ['spot:evm--1:0xabc'],
        priority: 1,
        refresh: 'idle',
      },
      payloads: { market: marketPayload },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: [],
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections.map((section) => section.id)).toEqual([
      'portfolio-assets',
      'portfolio-market',
      'portfolio-earn',
    ]);
    expect(sections[1]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spot:evm--1:0xabc',
          imageUrl: 'eth.png',
          renderer: 'market',
          title: 'ETH',
        }),
      ]),
    );
    expect(sections[2]?.items).toEqual([
      expect.objectContaining({
        imageUrl: 'usdc.png',
        renderer: 'earn',
        title: 'USDC',
      }),
    ]);
  });

  it('keeps a stable Market section while the owner-scoped cache misses', () => {
    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      marketSemantic: { kind: 'loading', placeholder: 'market' },
      payloads: {},
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: [],
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections).toEqual([
      { id: 'portfolio-assets', items: [] },
      {
        id: 'portfolio-market',
        title: 'Market',
        items: Array.from({ length: 3 }, (_, index) => ({
          id: `portfolio-market-loading-${index}`,
          displayHeight: 68,
          renderer: 'loading',
          title: 'Loading',
        })),
      },
    ]);
  });

  it('preserves the four-token recommendation selection and add action', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      chainId: 'evm--1',
      contractAddress: `0x${index}`,
      isNative: false,
      symbol: `TOKEN${index + 1}`,
      name: `Token ${index + 1}`,
      logoUrl: `token-${index + 1}.png`,
      price: 1,
      priceChange24h: 0,
      marketCap: 1,
      volume24h: 1,
    }));
    const marketPayload: IHomePopularTradingPayload = {
      categories: [
        { id: 'favorites', name: 'Favorites', iconName: 'StarOutline' },
      ],
      earnRows: [],
      favoriteMode: 'recommendation',
      perpsHotRows: [],
      prefetchCategoryIds: [],
      prefetchedRowsByRequestKey: {},
      resolvedCategoryId: 'favorites',
      rows,
      selectedCategoryId: 'favorites',
      totalFavorites: 0,
      watchListContentKey: 'watchlist-empty',
      watchListItems: [],
    };

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      marketRecommendationState: {
        actionTitle: 'Add 3 tokens',
        selectedRowIds: rows
          .slice(0, 3)
          .map((row) => `spot:${row.chainId}:${row.contractAddress}`),
      },
      marketSemantic: {
        kind: 'ready',
        rowIds: rows.map((row) => `spot:${row.chainId}:${row.contractAddress}`),
        priority: 1,
        refresh: 'idle',
      },
      payloads: { market: marketPayload },
      sectionId: 'portfolio',
      semantic: {
        kind: 'ready',
        rowIds: [],
        priority: 1,
        refresh: 'idle',
      },
    });
    const market = sections.find(
      (section) => section.id === 'portfolio-market',
    );

    expect(market).toMatchObject({
      actionId: 'home.native.market.recommended.add',
      actionDisabled: false,
      actionTitle: 'Add 3 tokens',
      layout: 'marketRecommendations',
    });
    expect(
      market?.items.filter((item) => item.renderer === 'market'),
    ).toHaveLength(4);
    expect(market?.items.at(-1)).toEqual(
      expect.objectContaining({ favorite: false, title: 'TOKEN4' }),
    );
    expect(market?.items.some((item) => item.renderer === 'showMore')).toBe(
      false,
    );
  });

  it('normalizes second timestamps and preserves History amount presentation', () => {
    const createdAtSeconds = Math.floor(Date.UTC(2026, 6, 22, 12, 0, 0) / 1000);
    const history = {
      id: 'history-receive',
      decodedTx: {
        accountId: 'account-a',
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            direction: EDecodedTxDirection.IN,
            assetTransfer: {
              from: '0xsender',
              to: '0xreceiver',
              sends: [],
              receives: [
                {
                  from: '0xsender',
                  to: '0xreceiver',
                  amount: '0.25',
                  icon: 'eth.png',
                  name: 'Ethereum',
                  symbol: 'ETH',
                  tokenIdOnNetwork: '',
                  price: '0.01',
                },
              ],
            },
          },
        ],
        createdAt: createdAtSeconds,
        extraInfo: null,
        networkId: 'evm--1',
        networkLogoURI: 'network.png',
        nonce: 0,
        owner: '0xreceiver',
        signer: '0xsender',
        status: EDecodedTxStatus.Confirmed,
        txid: '0xtx',
      },
    } as unknown as IAccountHistoryTx;
    const historyPayload: IHomeHistoryStorePayload = {
      addressMap: {},
      cursor: null,
      data: [history],
      hasMore: false,
      isLoadingMore: false,
      refresh: 'idle',
      tokenMap: {},
    };

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      isAllNetworks: true,
      payloads: { history: historyPayload },
      sectionId: 'history',
      semantic: {
        kind: 'ready',
        rowIds: [history.id],
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections[0]?.title).toContain('2026');
    expect(sections[0]?.items).toEqual([
      expect.objectContaining({
        badgeImageUrl: 'network.png',
        detail: '< $0.01',
        imageUrl: 'eth.png',
        renderer: 'history',
        title: 'Receive',
        value: '+0.25 ETH',
      }),
    ]);
  });

  it('arms History load-more for an idle last row in either network scope', () => {
    const history = {
      id: 'history-load-more',
      decodedTx: {
        accountId: 'account-a',
        actions: [],
        createdAt: Date.UTC(2026, 6, 22),
        networkId: 'evm--1',
        status: EDecodedTxStatus.Confirmed,
        txid: '0xloadmore',
      },
    } as unknown as IAccountHistoryTx;
    const historyPayload: IHomeHistoryStorePayload = {
      addressMap: {},
      cursor: 'next-page',
      data: [history],
      hasMore: true,
      isLoadingMore: false,
      refresh: 'idle',
      tokenMap: {},
    };
    const build = ({
      historyLoadingMore = false,
      isAllNetworks = false,
    }: {
      historyLoadingMore?: boolean;
      isAllNetworks?: boolean;
    }) =>
      buildMobileNativeHomeViewModelSections({
        ...presentation,
        historyLoadingMore,
        isAllNetworks,
        payloads: { history: historyPayload },
        sectionId: 'history',
        semantic: {
          kind: 'ready',
          rowIds: [history.id],
          priority: 1,
          refresh: 'idle',
        },
      });

    expect(build({}).at(-1)?.actionId).toBe(HOME_HISTORY_ACTION_IDS.loadMore);
    expect(
      build({ historyLoadingMore: true }).at(-1)?.actionId,
    ).toBeUndefined();
    expect(build({ isAllNetworks: true }).at(-1)?.actionId).toBe(
      HOME_HISTORY_ACTION_IDS.loadMore,
    );
  });

  it('renders UTXO change outputs as one net transfer like the React History row', () => {
    const recipient = 'bc1qrecipient';
    const history = {
      id: 'history-utxo-send',
      decodedTx: {
        accountId: 'account-a',
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            direction: EDecodedTxDirection.OUT,
            assetTransfer: {
              from: 'bc1qsender',
              to: recipient,
              sends: [
                {
                  from: 'bc1qsender',
                  to: recipient,
                  amount: '0.2',
                  icon: 'btc.png',
                  isOwn: true,
                  name: 'Bitcoin',
                  price: '63919',
                  symbol: 'BTC',
                  tokenIdOnNetwork: '',
                },
              ],
              receives: [
                {
                  from: 'bc1qsender',
                  to: recipient,
                  amount: '0.0000546',
                  icon: 'btc.png',
                  isOwn: false,
                  name: 'Bitcoin',
                  price: '63919',
                  symbol: 'BTC',
                  tokenIdOnNetwork: '',
                },
                {
                  from: 'bc1qsender',
                  to: 'bc1qchange',
                  amount: '0.1999454',
                  icon: 'btc.png',
                  isOwn: true,
                  name: 'Bitcoin',
                  price: '63919',
                  symbol: 'BTC',
                  tokenIdOnNetwork: '',
                },
              ],
            },
          },
        ],
        createdAt: Date.UTC(2025, 0, 9),
        extraInfo: null,
        nativeAmount: '0.0000546',
        networkId: 'btc--0',
        networkLogoURI: 'network.png',
        nonce: 0,
        owner: 'bc1qsender',
        payload: {
          label: '',
          type: EOnChainHistoryTxType.Send,
          value: '',
        },
        signer: 'bc1qsender',
        status: EDecodedTxStatus.Confirmed,
        txid: 'utxo-send',
      },
    } as unknown as IAccountHistoryTx;

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      isAllNetworks: true,
      payloads: {
        history: {
          addressMap: {
            [buildAddressMapInfoKey({
              address: recipient,
              networkId: 'btc--0',
            })]: {
              label: 'TEST / Account #3',
              type: 'default',
            },
          },
          cursor: null,
          data: [history],
          hasMore: false,
          isLoadingMore: false,
          refresh: 'idle',
          tokenMap: {},
        },
      },
      sectionId: 'history',
      semantic: {
        kind: 'ready',
        rowIds: [history.id],
        priority: 1,
        refresh: 'idle',
      },
    });

    expect(sections[0]?.items[0]).toEqual(
      expect.objectContaining({
        badgeImageUrl: 'network.png',
        detail: '$3.49',
        imageUrl: 'btc.png',
        subtitle: 'TEST / Account #3',
        title: 'Send',
        value: '-0.0000546 BTC',
      }),
    );
    expect(sections[0]?.items[0]?.secondaryImageUrl).toBeUndefined();
  });

  it('uses a compact subscript exponent for tiny History amounts', () => {
    const history = {
      id: 'history-tiny-send',
      decodedTx: {
        accountId: 'account-a',
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            direction: EDecodedTxDirection.OUT,
            assetTransfer: {
              from: '0xsender',
              to: '0xreceiver',
              sends: [
                {
                  from: '0xsender',
                  to: '0xreceiver',
                  amount: '0.000000000000000000001',
                  icon: 'eth.png',
                  name: 'Ethereum',
                  symbol: 'ETH',
                  tokenIdOnNetwork: '',
                  price: '1',
                },
              ],
              receives: [],
            },
          },
        ],
        createdAt: Date.UTC(2026, 6, 22),
        extraInfo: null,
        networkId: 'evm--1',
        networkLogoURI: 'network.png',
        nonce: 0,
        owner: '0xsender',
        signer: '0xsender',
        status: EDecodedTxStatus.Confirmed,
        txid: '0xtiny',
      },
    } as unknown as IAccountHistoryTx;

    const sections = buildMobileNativeHomeViewModelSections({
      ...presentation,
      payloads: {
        history: {
          addressMap: {},
          cursor: null,
          data: [history],
          hasMore: false,
          isLoadingMore: false,
          refresh: 'idle',
          tokenMap: {},
        },
      },
      sectionId: 'history',
      semantic: {
        kind: 'ready',
        rowIds: [history.id],
        priority: 1,
        refresh: 'idle',
      },
    });
    const value = sections[0]?.items[0]?.value ?? '';

    expect(value).toContain('₂₀');
    expect(value).not.toContain('00000000000000000000');
  });
});
