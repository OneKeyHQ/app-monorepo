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
  buildNativeHistorySections,
  buildNativeNFTSections,
  buildNativePerpsSections,
  buildNativePortfolioSections,
} from './nativeHomeDataAdapters';

const stateLabels = { empty: 'Empty', loading: 'Loading' };
const formatters = {
  formatBalance: (value: string) => value,
  formatFiat: (value: string | number | undefined) => `$${value ?? '0'}`,
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
    expect(sections[1].items[0]).toMatchObject({
      badge: 'Long 3x',
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
      },
      formatBalance: (value) => value,
      formatSectionDate: () => 'Today',
      formatTimestamp: () => '10:00',
    });

    expect(sections[0]).toMatchObject({ id: 'history:0:Today' });
    expect(sections[0].items[0]).toMatchObject({
      id: history.id,
      title: 'Send',
      value: '-0.5 ETH',
      badge: 'Confirmed',
      actionId: NATIVE_HOME_ACTION_IDS.openHistory,
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
