import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import {
  NATIVE_HOME_ACTION_IDS,
  buildNativeDeFiSections,
  buildNativeHistorySections,
  buildNativeNFTSections,
  buildNativePerpsSections,
  buildNativePortfolioSections,
} from './nativeHomeDataAdapters';

const stateLabels = { empty: 'Empty', loading: 'Loading' };
const formatters = {
  formatBalance: (value: string) => value,
  formatFiat: (value: string | number | undefined) => `$${value ?? '0'}`,
  formatPrice: (value: string | number | undefined) => `price:${value ?? '0'}`,
};

describe('nativeHomeDataAdapters', () => {
  it('builds stable portfolio rows from the BG token snapshot', () => {
    const token = {
      $key: 'evm--1:eth',
      address: '',
      decimals: 18,
      isNative: true,
      logoURI: 'https://example.com/eth.png',
      name: 'Ethereum',
      networkName: 'Ethereum',
      symbol: 'ETH',
    } satisfies IAccountToken;
    const fiat = {
      balance: '1',
      balanceParsed: '1',
      fiatValue: '3000',
      price: 3000,
    } satisfies ITokenFiat;

    const sections = buildNativePortfolioSections({
      tokens: [token],
      tokenMap: { [token.$key]: fiat },
      initialized: true,
      sectionTitle: 'Assets',
      stateLabels,
      formatters,
    });

    expect(sections[0].items[0]).toMatchObject({
      id: token.$key,
      title: 'ETH',
      subtitle: 'price:3000',
      titleAccessoryIcon: 'gas',
      value: '1',
      detail: '$3000',
      actionId: NATIVE_HOME_ACTION_IDS.openAsset,
    });
  });

  it('matches the legacy Home limit and hides zero balances when requested', () => {
    const tokens = Array.from({ length: 8 }, (_, index) => ({
      $key: `evm--1:token-${index}`,
      address: `${index}`,
      decimals: 18,
      isNative: false,
      name: `Token ${index}`,
      symbol: `T${index}`,
    })) satisfies IAccountToken[];
    const tokenMap = Object.fromEntries(
      tokens.map((token, index) => [
        token.$key,
        {
          balance: index === 0 ? '0' : '1',
          balanceParsed: index === 0 ? '0' : '1',
          fiatValue: `${index}`,
          price: index,
        } satisfies ITokenFiat,
      ]),
    );

    const sections = buildNativePortfolioSections({
      tokens,
      tokenMap,
      initialized: true,
      hideZeroBalanceTokens: true,
      sectionTitle: 'Assets',
      stateLabels,
      formatters,
    });

    expect(sections[0].items).toHaveLength(6);
    expect(sections[0].items.map((item) => item.id)).not.toContain(
      tokens[0].$key,
    );

    const expandedSections = buildNativePortfolioSections({
      tokens,
      tokenMap,
      initialized: true,
      hideZeroBalanceTokens: true,
      sectionTitle: 'Assets',
      stateLabels,
      formatters,
      expanded: true,
    });
    expect(expandedSections[0].items).toHaveLength(7);
  });

  it('matches the legacy Home fiat-value order before applying the row limit', () => {
    const tokens = [
      { $key: 'bnb', symbol: 'BNB' },
      { $key: 'usdt', symbol: 'USDT' },
      { $key: 'usdc', symbol: 'USDC' },
    ].map(
      ({ $key, symbol }) =>
        ({
          $key,
          address: $key,
          decimals: 18,
          isNative: symbol === 'BNB',
          name: symbol,
          symbol,
        }) satisfies IAccountToken,
    );
    const tokenMap = {
      bnb: {
        balance: '1',
        balanceParsed: '1',
        fiatValue: '0.30',
        price: 0.3,
      },
      usdt: {
        balance: '1',
        balanceParsed: '1',
        fiatValue: '0.56',
        price: 0.56,
      },
      usdc: {
        balance: '1',
        balanceParsed: '1',
        fiatValue: '0.52',
        price: 0.52,
      },
    } satisfies Record<string, ITokenFiat>;

    const sections = buildNativePortfolioSections({
      tokens,
      tokenMap,
      initialized: true,
      stateLabels,
      formatters,
    });

    expect(sections[0].items.map((item) => item.id)).toEqual([
      'usdt',
      'usdc',
      'bnb',
    ]);
  });

  it('matches the legacy token footer order and label semantics', () => {
    const tokens = Array.from({ length: 7 }, (_, index) => ({
      $key: `evm--1:token-${index}`,
      address: `${index}`,
      decimals: 18,
      isNative: index === 0,
      name: `Token ${index}`,
      symbol: `T${index}`,
    })) satisfies IAccountToken[];
    const common = {
      tokens,
      tokenMap: {},
      initialized: true,
      stateLabels,
      formatters,
      footer: {
        addTokenEnabled: true,
        labels: {
          addToken: 'Add token',
          addTokenInstruction: "Can't find your token?",
          lowValueAssets: 'Low-value assets',
          riskAssets: '2 Collapsed risk assets',
          showLess: 'Show less',
          showMore: 'Show more',
        },
        lowValueAssetsCount: 3,
        lowValueAssetsValue: '< $0.01',
        riskAssetsCount: 2,
      },
    };

    const collapsed = buildNativePortfolioSections(common);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[1].items[0]).toMatchObject({
      renderer: 'showMore',
      title: 'Show more',
    });

    const expanded = buildNativePortfolioSections({
      ...common,
      expanded: true,
    });
    expect(expanded[1].items).toMatchObject([
      {
        title: '3 Low-value assets',
        value: '< $0.01',
        actionId: NATIVE_HOME_ACTION_IDS.openSmallBalanceAssets,
      },
      {
        title: '2 Collapsed risk assets',
        actionId: NATIVE_HOME_ACTION_IDS.openRiskAssets,
      },
      {
        renderer: 'addToken',
        title: "Can't find your token?",
        buttonTitle: 'Add token',
        actionId: NATIVE_HOME_ACTION_IDS.manageTokens,
      },
    ]);
    expect(expanded[2].items[0]).toMatchObject({
      renderer: 'showMore',
      title: 'Show less',
    });
  });

  it('expands and collapses DeFi rows without changing their action identity', () => {
    const protocols = Array.from({ length: 8 }, (_, index) => ({
      networkId: 'evm--1',
      owner: '0xowner',
      protocol: `protocol-${index}`,
      categories: [],
      positions: [],
    }));
    const common = {
      protocols,
      protocolMap: {},
      initialized: true,
      stateLabels,
      formatters,
      labels: {
        positions: 'Positions',
        showMore: 'Show more',
        showLess: 'Show less',
      },
      toggleActionId: NATIVE_HOME_ACTION_IDS.toggleDeFiExpanded,
    };

    const collapsed = buildNativeDeFiSections(common);
    expect(collapsed[0].items).toHaveLength(6);
    expect(collapsed[1].items[0]).toMatchObject({
      title: 'Show more',
      actionId: NATIVE_HOME_ACTION_IDS.toggleDeFiExpanded,
    });

    const expanded = buildNativeDeFiSections({ ...common, expanded: true });
    expect(expanded[0].items).toHaveLength(8);
    expect(expanded[1].items[0]).toMatchObject({ title: 'Show less' });
  });

  it('preserves loading and empty as explicit native rows', () => {
    expect(
      buildNativeNFTSections({
        nfts: [],
        initialized: false,
        sectionTitle: 'NFTs',
        stateLabels,
      })[0].items[0],
    ).toMatchObject({
      renderer: 'loading',
      title: 'Loading',
      displayHeight: 760,
    });
    expect(
      buildNativeNFTSections({
        nfts: [],
        initialized: true,
        sectionTitle: 'NFTs',
        stateLabels,
      })[0].items[0],
    ).toMatchObject({
      renderer: 'empty',
      title: 'Empty',
      displayHeight: 320,
    });
  });

  it('maps perps holdings and positions into independent native sections', () => {
    const sections = buildNativePerpsSections({
      initialized: true,
      view: {
        isEmpty: false,
        accountValueUsd: 120,
        isDegraded: false,
        holdings: [
          {
            symbol: 'USDC',
            displaySymbol: 'USDC',
            balance: '100',
            valueUsd: 100,
            pnlUsd: 0,
          },
        ],
        positions: [
          {
            coin: 'BTC',
            side: 'long',
            leverageType: 'cross',
            leverageValue: 3,
            pnlUsd: 20,
            roi: 0.2,
            sizeCoin: '0.01',
            marginUsd: 100,
            entryPx: '60000',
            fundingUsd: 0,
            markPx: '62000',
            liqPx: null,
          },
        ],
      },
      labels: {
        long: 'Long',
        margin: 'Margin',
        pnl: 'PnL',
        positions: 'Positions',
        short: 'Short',
      },
      stateLabels,
      formatters,
    });

    expect(sections.map((section) => section.id)).toEqual([
      'perps-holdings',
      'perps-positions',
    ]);
    expect(sections[0].items[0]).toMatchObject({
      subtitle: '100',
      value: '$100',
      detail: '+$0',
      badgeImageUrl: 'https://uni.onekey-asset.com/static/chain/hyper-evm.png',
      imageUrl: 'https://uni.onekey-asset.com/static/hyperliquid/USDC.png',
    });
    expect(sections[1].items[0]).toMatchObject({
      badge: 'Long 3x',
      imageUrl: 'https://uni.onekey-asset.com/static/hyperliquid/BTC.png',
      actionId: NATIVE_HOME_ACTION_IDS.openPerpsPosition,
    });
  });

  it('groups history rows and retains click identity', () => {
    const history = {
      id: 'history-1',
      decodedTx: {
        txid: '0x1',
        owner: '0xowner',
        signer: '0xowner',
        nonce: 1,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            direction: EDecodedTxDirection.OUT,
            assetTransfer: {
              from: '0xowner',
              to: '0xto',
              sends: [
                {
                  from: '0xowner',
                  to: '0xto',
                  amount: '0.5',
                  icon: 'https://example.com/eth.png',
                  name: 'Ethereum',
                  symbol: 'ETH',
                  tokenIdOnNetwork: '',
                },
              ],
              receives: [],
            },
          },
        ],
        createdAt: 100,
        status: EDecodedTxStatus.Confirmed,
        networkId: 'evm--1',
        accountId: 'account-1',
        extraInfo: null,
      },
    } satisfies IAccountHistoryTx;

    const sections = buildNativeHistorySections({
      history: [history],
      initialized: true,
      stateLabels,
      labels: {
        approve: 'Approve',
        contract: 'Contract',
        receive: 'Receive',
        send: 'Send',
        status: { [EDecodedTxStatus.Confirmed]: 'Confirmed' },
        swap: 'Swap',
        unknown: 'Unknown',
        revokeApprove: (symbol) => `Revoke ${symbol}`,
      },
      formatBalance: (value) => value,
      formatSectionDate: () => 'Today',
      formatTimestamp: () => '10:00',
      loadMoreActionId: NATIVE_HOME_ACTION_IDS.loadMoreHistory,
    });

    expect(sections[0]).toMatchObject({
      id: 'history:0:Today',
      actionId: NATIVE_HOME_ACTION_IDS.loadMoreHistory,
    });
    expect(sections[0].items[0]).toMatchObject({
      id: history.id,
      title: 'Send',
      value: '-0.5 ETH',
      actionId: NATIVE_HOME_ACTION_IDS.openHistory,
    });
    expect(sections[0].items[0].badge).toBeUndefined();
  });

  it('matches legacy history address labels and paired transfer icon order', () => {
    const history = {
      id: 'history-swap',
      decodedTx: {
        txid: '0xswap',
        owner: '0xowner',
        signer: '0xowner',
        nonce: 2,
        actions: [
          {
            type: EDecodedTxActionType.ASSET_TRANSFER,
            direction: EDecodedTxDirection.OUT,
            assetTransfer: {
              from: '0xowner',
              to: '0xrouter',
              isInternalSwap: true,
              sends: [
                {
                  from: '0xowner',
                  to: '0xrouter',
                  amount: '1',
                  icon: 'https://example.com/eth.png',
                  name: 'Ethereum',
                  symbol: 'ETH',
                  tokenIdOnNetwork: '',
                },
              ],
              receives: [
                {
                  from: '0xrouter',
                  to: '0xowner',
                  amount: '3000',
                  icon: 'https://example.com/usdc.png',
                  name: 'USD Coin',
                  symbol: 'USDC',
                  tokenIdOnNetwork: '0xusdc',
                },
              ],
            },
          },
        ],
        createdAt: 100,
        status: EDecodedTxStatus.Confirmed,
        networkId: 'evm--1',
        accountId: 'account-1',
        extraInfo: null,
      },
    } satisfies IAccountHistoryTx;

    const sections = buildNativeHistorySections({
      addressMap: {
        'evm--1_0xrouter': {
          label: 'Uniswap',
          type: 'default',
        },
      },
      history: [history],
      initialized: true,
      stateLabels,
      labels: {
        approve: 'Approve',
        contract: 'Contract',
        receive: 'Receive',
        send: 'Send',
        status: {},
        swap: 'Swap',
        unknown: 'Unknown',
        revokeApprove: (symbol) => `Revoke ${symbol}`,
      },
      formatBalance: (value) => value,
      formatSectionDate: () => 'Today',
      formatTimestamp: () => '10:00',
    });

    expect(sections[0].items[0]).toMatchObject({
      title: 'Swap',
      subtitle: 'Uniswap',
      imageUrl: 'https://example.com/eth.png',
      secondaryImageUrl: 'https://example.com/usdc.png',
      value: '+3000 USDC',
      detail: '-1 ETH',
    });
  });

  it('uses a stable NFT identity across account refreshes', () => {
    const nft = {
      amount: '1',
      collectionAddress: '0xcollection',
      collectionName: 'OneKey',
      collectionSymbol: 'OK',
      collectionType: 'ERC-721',
      itemId: '7',
      networkId: 'evm--1',
      metadata: {
        description: '',
        externalUrl: '',
        image: 'https://example.com/7.png',
        itemUrl: '',
        name: 'OneKey #7',
      },
    } as IAccountNFT;

    const sections = buildNativeNFTSections({
      nfts: [nft],
      initialized: true,
      sectionTitle: 'NFTs',
      stateLabels,
      networkImageById: { 'evm--1': 'https://example.com/evm.png' },
    });
    const item = sections[0].items[0];

    expect(sections[0].layout).toBe('grid');
    expect(item).toMatchObject({
      id: 'evm--1:0xcollection:7',
      actionId: NATIVE_HOME_ACTION_IDS.openNFT,
      badgeImageUrl: 'https://example.com/evm.png',
    });
  });
});
