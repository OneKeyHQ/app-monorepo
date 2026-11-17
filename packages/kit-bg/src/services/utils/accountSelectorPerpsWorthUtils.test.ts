import {
  buildAccountsPerpsNetWorthUsd,
  isResolvableIndexedAccountId,
} from './accountSelectorPerpsWorthUtils';

const HL_ADDRESS = '0x92bA0000000000000000000000000000C0DE5178';
const HL_ADDRESS_LOWER = HL_ADDRESS.toLowerCase();

describe('isResolvableIndexedAccountId', () => {
  it('accepts real indexed account ids', () => {
    expect(isResolvableIndexedAccountId('hd-1--0')).toBe(true);
    expect(isResolvableIndexedAccountId('hw-abc-def--12')).toBe(true);
  });

  it('rejects the degenerate ids built for others-wallet rows', () => {
    expect(isResolvableIndexedAccountId(undefined)).toBe(false);
    expect(isResolvableIndexedAccountId('')).toBe(false);
    expect(isResolvableIndexedAccountId('--undefined')).toBe(false);
    expect(isResolvableIndexedAccountId('--NaN')).toBe(false);
    expect(isResolvableIndexedAccountId('--0')).toBe(false);
  });
});

describe('buildAccountsPerpsNetWorthUsd', () => {
  const snapshotNetWorthUsdByAddress = {
    [HL_ADDRESS_LOWER]: '502.00',
  };

  it('matches EVM row addresses against the snapshot cache', async () => {
    const resolve = jest.fn();
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [
        { accountId: 'a1', accountAddress: HL_ADDRESS },
        {
          accountId: 'a2',
          accountAddress: '0x0000000000000000000000000000000000000001',
        },
      ],
      snapshotNetWorthUsdByAddress,
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual(['502.00', undefined]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('resolves indexed accounts without an EVM address in one batch', async () => {
    const resolve = jest.fn(async (indexedAccountIds: string[]) =>
      Object.fromEntries(indexedAccountIds.map((id) => [id, HL_ADDRESS])),
    );
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [
        { accountId: 'a1', indexedAccountId: 'hd-1--0', accountAddress: '' },
        {
          accountId: 'a2',
          indexedAccountId: 'hd-1--1',
          accountAddress: 'bc1qsomebtcaddress',
        },
      ],
      snapshotNetWorthUsdByAddress,
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual(['502.00', '502.00']);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(['hd-1--0', 'hd-1--1']);
  });

  it('dedupes ids and routes indexed rows through the resolver even when the row carries an EVM scene address', async () => {
    // The indexed row's scene address (HL_ADDRESS) must NOT shortcut the
    // lookup: Home resolves via the perps global derive type, which here
    // yields a different address that is absent from the snapshot cache.
    const resolve = jest.fn(async () => ({
      'hd-1--0': HL_ADDRESS,
      'hd-1--1': '0x0000000000000000000000000000000000000002',
    }));
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [
        { accountId: 'a1', indexedAccountId: 'hd-1--0', accountAddress: '' },
        { accountId: 'a2', indexedAccountId: 'hd-1--0', accountAddress: '' },
        {
          accountId: 'a3',
          indexedAccountId: 'hd-1--1',
          accountAddress: HL_ADDRESS,
        },
      ],
      snapshotNetWorthUsdByAddress,
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual(['502.00', '502.00', undefined]);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(['hd-1--0', 'hd-1--1']);
  });

  it('skips others rows with non-EVM addresses and no indexed id', async () => {
    const resolve = jest.fn();
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [
        {
          accountId: 'imported--btc',
          indexedAccountId: '--undefined',
          accountAddress: 'bc1qsomebtcaddress',
        },
      ],
      snapshotNetWorthUsdByAddress,
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual([undefined]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('short-circuits when the snapshot cache is empty', async () => {
    const resolve = jest.fn();
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [{ accountId: 'a1', indexedAccountId: 'hd-1--0' }],
      snapshotNetWorthUsdByAddress: {},
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual([undefined]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('returns undefined for rows the batch resolver left unresolved', async () => {
    const resolve = jest.fn(async () => ({}));
    const result = await buildAccountsPerpsNetWorthUsd({
      accounts: [{ accountId: 'a1', indexedAccountId: 'hd-1--0' }],
      snapshotNetWorthUsdByAddress,
      resolvePerpsAddressesByIndexedAccountIds: resolve,
    });
    expect(result).toEqual([undefined]);
  });
});
