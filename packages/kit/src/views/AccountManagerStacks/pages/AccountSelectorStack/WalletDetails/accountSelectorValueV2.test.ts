import { formatAccountSelectorValueV2 } from './accountSelectorValueV2';

const currencyMap = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: [], value: '1' },
  cny: { id: 'cny', unit: '¥', name: 'Chinese Yuan', type: [], value: '7' },
};
const defaults = {
  walletId: 'hd-wallet',
  linkedAccountId: 'account-1',
  linkedNetworkId: 'evm--1',
  enabledNetworksCompatibleWithWalletId: [],
  networkInfoMap: {},
  currencyMap,
  targetCurrency: 'usd',
  hideValue: false,
};

describe('account selector V2 values', () => {
  it('adds scalar token, DeFi, and USD perps balances before converting display currency', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        accountValue: { accountId: 'account-1', currency: 'cny', value: '70' },
        overview: {
          overview: {
            'evm--1': {
              netWorth: 14,
              totalValue: 14,
              totalDebt: 0,
              totalReward: 0,
              currency: 'cny',
            },
          },
          perpsNetWorthUsd: '3',
        },
      }),
    ).toEqual({ text: '$15.00', tone: 'secondary' });
  });

  it('prefers the active account value without discarding the selector DeFi value', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        accountValue: { accountId: 'account-1', currency: 'usd', value: '1' },
        activeAccountValue: {
          accountId: 'account-1',
          currency: 'usd',
          value: '20',
        },
        overview: { overview: {}, perpsNetWorthUsd: '5' },
      }),
    ).toEqual({ text: '$25.00', tone: 'secondary' });
  });

  it('preserves unavailable single-network values and hides placeholders when requested', () => {
    const params = {
      ...defaults,
      accountValue: { accountId: 'account-1', currency: 'usd', value: {} },
    };
    expect(formatAccountSelectorValueV2(params)).toEqual({
      text: '--',
      tone: 'disabled',
    });
    expect(
      formatAccountSelectorValueV2({ ...params, hideValue: true }),
    ).toEqual({ text: '****', tone: 'disabled' });
  });

  it('sums only the linked merge-derive chain and does not add DeFi or perps', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        linkedNetworkId: 'btc--0',
        mergeDeriveAssetsEnabled: true,
        accountValue: {
          accountId: 'account-1',
          currency: 'usd',
          value: {
            'account-1_btc--0': '2',
            'account-2_btc--0': '3',
            'account-1_evm--1': '100',
          },
        },
        overview: { overview: {}, perpsNetWorthUsd: '50' },
      }),
    ).toEqual({ text: '$5.00', tone: 'secondary' });
  });

  it('ignores missing DeFi network entries in all-network mode', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        linkedNetworkId: 'onekeyall--0',
        accountValue: { accountId: 'account-1', currency: 'usd', value: {} },
        overview: {
          overview: {
            'evm--1': undefined as never,
            'evm--137': {
              netWorth: 4,
              totalValue: 4,
              totalDebt: 0,
              totalReward: 0,
              currency: 'usd',
            },
          },
        },
      }),
    ).toEqual({ text: '$4.00', tone: 'secondary' });
  });

  it('keeps the source currency unit until the target exchange rate is available', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        currencyMap: { usd: currencyMap.usd },
        targetCurrency: 'cny',
        accountValue: { accountId: 'account-1', currency: 'usd', value: '10' },
      }),
    ).toEqual({ text: '$10.00', tone: 'secondary' });
  });

  it('preserves the zero-count subscript for small balances', () => {
    expect(
      formatAccountSelectorValueV2({
        ...defaults,
        accountValue: {
          accountId: 'account-1',
          currency: 'usd',
          value: '0.0000041',
        },
      }),
    ).toEqual({
      text: '$0.0000041',
      textSegments: [
        { text: '$' },
        { text: '0.0' },
        { text: '5', style: 'subscript' },
        { text: '41' },
      ],
      tone: 'secondary',
    });
  });
});
