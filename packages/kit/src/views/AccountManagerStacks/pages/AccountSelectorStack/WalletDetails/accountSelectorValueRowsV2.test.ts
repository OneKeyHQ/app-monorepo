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
    accountDeFi: {},
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
      })[17].subtitleSegments?.[0].text,
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
      getRows({ ...input, activeAccountValue: active })[0].subtitleSegments?.[0]
        .text,
    ).toBe('$10.00');
    expect(format).toHaveBeenCalledTimes(4);
    const rows = getRows({
      ...input,
      activeAccountValue: { ...active, accountId: 'account-1' },
    });
    expect(rows[0].subtitleSegments?.[0].text).toBe('$1.00');
    expect(rows[1].subtitleSegments?.[0].text).toBe('$10.00');
    expect(format).toHaveBeenCalledTimes(6);
    const selectedRows = getRows({
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
    const deFi = { 'account-0': { overview: {}, perpsNetWorthUsd: '3' } };
    expect(
      getRows({ ...input, accountDeFi: deFi })[0].subtitleSegments?.[0].text,
    ).toBe('$4.00');
    expect(format).toHaveBeenCalledTimes(3);
    expect(
      getRows({ ...input, context: { ...input.context, hideValue: true } })[0]
        .subtitleSegments?.[0].text,
    ).toBe('****');
    expect(format).toHaveBeenCalledTimes(5);
    getRows({ ...input, staticRows: [], records: [] });
    getRows(input);
    expect(format).toHaveBeenCalledTimes(7);
  });
});
