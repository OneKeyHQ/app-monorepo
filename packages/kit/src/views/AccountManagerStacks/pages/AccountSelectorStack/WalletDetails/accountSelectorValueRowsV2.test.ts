import { createAccountSelectorValueRowsV2 } from './accountSelectorValueRowsV2';
import { formatAccountSelectorValueV2 } from './accountSelectorValueV2';

import type { IAccountSelectorRowRecordV2 } from './accountSelectorAccountRowsV2';
import type { IdentityRow } from '@onekeyfe/react-native-native-list';

function fixture(count = 1000) {
  const staticRows: IdentityRow[] = Array.from(
    { length: count },
    (_, index) => ({
      type: 'identity',
      leading: { kind: 'account' },
      key: `account-${index}`,
      title: `Account ${index}`,
      subtitleSegments: [{ text: `address-${index}` }],
    }),
  );
  return {
    staticRows,
    records: staticRows.map((row) => ({
      item: { id: row.key },
      key: row.key,
    })) as IAccountSelectorRowRecordV2[],
    accountValues: Object.fromEntries(
      staticRows.map((row) => [
        row.key,
        { accountId: row.key, currency: 'usd', value: '1' },
      ]),
    ),
    activeAccountValue: undefined,
    context: {
      walletId: 'hd-1',
      networkId: 'evm--1',
      enabledNetworksCompatibleWithWalletId: [],
      networkInfoMap: {},
      currencyMap: {
        usd: { id: 'usd', unit: '$', name: 'Dollar', type: [], value: '1' },
      },
      targetCurrency: 'usd',
      hideValue: false,
    },
    skipValues: false,
  };
}

describe('account V2 formatting invalidation', () => {
  it('reuses all 1000 rows for equal context references and unrelated active updates', () => {
    const format = jest.fn(formatAccountSelectorValueV2);
    const getRows = createAccountSelectorValueRowsV2(format);
    const input = fixture();
    const initial = getRows(input);
    expect(format).toHaveBeenCalledTimes(1000);
    expect(
      getRows({
        ...input,
        context: {
          ...input.context,
          networkInfoMap: {},
          enabledNetworksCompatibleWithWalletId: [],
        },
        activeAccountValue: {
          accountId: 'another-wallet',
          currency: 'usd',
          value: '10',
        },
      }),
    ).toBe(initial);
    expect(format).toHaveBeenCalledTimes(1000);
    expect(
      getRows({
        ...input,
        accountValues: {
          ...input.accountValues,
          'account-17': {
            accountId: 'account-17',
            currency: 'usd',
            value: '2',
          },
        },
      }).rows[17].subtitleSegments?.[0].text,
    ).toBe('$2.00');
    expect(format).toHaveBeenCalledTimes(1001);
  });

  it('invalidates only the old/new active accounts and preserves static row changes', () => {
    const format = jest.fn(formatAccountSelectorValueV2);
    const getRows = createAccountSelectorValueRowsV2(format);
    const input = fixture(3);
    getRows(input);
    const active = { accountId: 'account-0', currency: 'usd', value: '10' };
    expect(
      getRows({ ...input, activeAccountValue: active }).rows[0]
        .subtitleSegments?.[0].text,
    ).toBe('$10.00');
    expect(format).toHaveBeenCalledTimes(4);
    const { rows } = getRows({
      ...input,
      activeAccountValue: { ...active, accountId: 'account-1' },
    });
    expect(rows[0].subtitleSegments?.[0].text).toBe('$1.00');
    expect(rows[1].subtitleSegments?.[0].text).toBe('$10.00');
    expect(format).toHaveBeenCalledTimes(6);
    const { rows: selectedRows } = getRows({
      ...input,
      activeAccountValue: { ...active, accountId: 'account-1' },
      staticRows: input.staticRows.map((row) => ({
        ...row,
        selected: row.key === 'account-1',
      })),
    });
    expect(selectedRows[1].selected).toBe(true);
    expect(format).toHaveBeenCalledTimes(6);
    expect(selectedRows[1].subtitleSegments?.[1].text).toBe('address-1');
  });

  it('updates DeFi, rate and hidden-value context and evicts removed accounts', () => {
    const format = jest.fn(formatAccountSelectorValueV2);
    const getRows = createAccountSelectorValueRowsV2(format);
    const input = fixture(2);
    getRows(input);
    const withDeFi = {
      ...input.accountValues,
      'account-0': {
        ...input.accountValues['account-0'],
        deFi: { overview: {}, perpsNetWorthUsd: '3' },
      },
    };
    expect(
      getRows({ ...input, accountValues: withDeFi }).rows[0]
        .subtitleSegments?.[0].text,
    ).toBe('$4.00');
    expect(format).toHaveBeenCalledTimes(3);
    expect(
      getRows({ ...input, context: { ...input.context, hideValue: true } })
        .rows[0].subtitleSegments?.[0].text,
    ).toBe('****');
    expect(format).toHaveBeenCalledTimes(5);
    getRows({ ...input, staticRows: [], records: [] });
    getRows(input);
    expect(format).toHaveBeenCalledTimes(7);
  });

  it('shows displayed texts until each account value loads, then formats live data', () => {
    const format = jest.fn(formatAccountSelectorValueV2);
    const getRows = createAccountSelectorValueRowsV2(format);
    const input = fixture(3);
    const displayedValues = {
      'account-0': { text: '$1.00', tone: 'secondary' as const },
      'account-1': { text: '$9.99', tone: 'secondary' as const },
    };

    const cached = getRows({ ...input, accountValues: {}, displayedValues });
    expect(cached.rows.map((row) => row.subtitleSegments?.[0])).toEqual([
      displayedValues['account-0'],
      displayedValues['account-1'],
      { text: '--', tone: 'disabled' },
    ]);
    expect(cached.sources).toEqual({
      'account-0': 'displayed',
      'account-1': 'displayed',
      'account-2': 'pending',
    });
    expect(format).not.toHaveBeenCalled();

    // Only account-0 loaded: it switches to live data, account-1 keeps its text.
    const partial = getRows({
      ...input,
      accountValues: { 'account-0': input.accountValues['account-0'] },
      displayedValues,
    });
    expect(partial.rows[0].subtitleSegments?.[0]).toEqual({
      text: '$1.00',
      tone: 'secondary',
    });
    expect(partial.rows[1]).toBe(cached.rows[1]);
    expect(partial.sources['account-0']).toBe('live');
    expect(format).toHaveBeenCalledTimes(1);
  });

  it('never replaces a displayed text with an item that has no stored value', () => {
    const getRows = createAccountSelectorValueRowsV2();
    const input = fixture(2);
    // What the service returns on a storage miss or a failed read.
    const stub = (accountId: string) => ({
      accountId,
      value: undefined,
      currency: undefined,
    });

    const result = getRows({
      ...input,
      accountValues: {
        'account-0': stub('account-0'),
        'account-1': stub('account-1'),
      },
      displayedValues: {
        'account-0': { text: '$4.20', tone: 'secondary' as const },
      },
    });
    expect(result.rows.map((row) => row.subtitleSegments?.[0])).toEqual([
      { text: '$4.20', tone: 'secondary' },
      { text: '--', tone: 'disabled' },
    ]);
    // Without a displayed text the placeholder is final, not pending.
    expect(result.sources).toEqual({
      'account-0': 'displayed',
      'account-1': 'live',
    });
  });

  it('keeps the displayed text while wallet networks are unresolved in all-network mode', () => {
    const getRows = createAccountSelectorValueRowsV2();
    const input = fixture(2);
    const allNetworks = {
      ...input,
      context: {
        ...input.context,
        networkId: 'onekeyall--0',
        walletNetworksReady: false,
      },
      accountValues: {
        'account-0': {
          accountId: 'account-0',
          currency: 'usd',
          value: { 'hd-1--0_evm--1': '7' },
        },
        'account-1': {
          accountId: 'account-1',
          currency: 'usd',
          value: { 'hd-1--1_evm--1': '3' },
        },
      },
      displayedValues: {
        'account-0': { text: '$7.00', tone: 'secondary' as const },
      },
    };

    const unresolved = getRows(allNetworks);
    expect(unresolved.rows[0].subtitleSegments?.[0].text).toBe('$7.00');
    expect(unresolved.rows[1].subtitleSegments?.[0].text).toBe('--');
    expect(unresolved.sources).toEqual({
      'account-0': 'displayed',
      'account-1': 'pending',
    });

    const resolved = getRows({
      ...allNetworks,
      context: {
        ...allNetworks.context,
        walletNetworksReady: true,
        enabledNetworksCompatibleWithWalletId: [{ id: 'evm--1' }] as never,
        networkInfoMap: {
          'evm--1': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
        },
      },
    });
    expect(resolved.rows.map((row) => row.subtitleSegments?.[0].text)).toEqual([
      '$7.00',
      '$3.00',
    ]);
    expect(resolved.sources).toEqual({
      'account-0': 'live',
      'account-1': 'live',
    });
  });
});
