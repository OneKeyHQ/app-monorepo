import {
  getTrezorSuiteBtcReceivePath,
  getTrezorSuiteDefaultAccountTitleFromPath,
  matchAccountNamesByAddress,
} from './thirdPartyAccountNameSync';

describe('matchAccountNamesByAddress', () => {
  it('matches every OneKey indexed account globally by normalized address', () => {
    expect(
      matchAccountNamesByAddress({
        sourceAccounts: [
          {
            name: 'Ledger Main',
            address: `0x${'AB'.repeat(20)}`,
          },
        ],
        targetAccounts: [
          {
            indexedAccountId: 'hw-1--0',
            currentName: 'Account 1',
            address: `  0x${'ab'.repeat(20)}  `,
          },
          {
            indexedAccountId: 'hw-2--0',
            currentName: 'Account 1',
            address: `0x${'ab'.repeat(20)}`,
          },
        ],
      }),
    ).toEqual([
      {
        indexedAccountId: 'hw-1--0',
        currentName: 'Account 1',
        sourceName: 'Ledger Main',
        sourceNames: ['Ledger Main'],
        matchedAddress: `0x${'ab'.repeat(20)}`,
      },
      {
        indexedAccountId: 'hw-2--0',
        currentName: 'Account 1',
        sourceName: 'Ledger Main',
        sourceNames: ['Ledger Main'],
        matchedAddress: `0x${'ab'.repeat(20)}`,
      },
    ]);
  });

  it('offers every name when one address carries several, deduping repeated rows', () => {
    const address = `0x${'12'.repeat(20)}`;
    expect(
      matchAccountNamesByAddress({
        sourceAccounts: [
          { name: 'Ethereum 1', address },
          { name: 'New Polygon 1', address },
          { name: 'Ethereum 1', address },
        ],
        targetAccounts: [
          {
            indexedAccountId: 'hw-1--0',
            currentName: 'Account 1',
            address,
          },
          {
            indexedAccountId: 'hw-1--0',
            currentName: 'Account 1',
            address,
          },
        ],
      }),
    ).toEqual([
      {
        indexedAccountId: 'hw-1--0',
        currentName: 'Account 1',
        sourceName: 'Ethereum 1',
        sourceNames: ['Ethereum 1', 'New Polygon 1'],
        matchedAddress: address,
      },
    ]);
  });

  it('drops only the name equal to the current one, keeping the rest', () => {
    const address = `0x${'34'.repeat(20)}`;
    expect(
      matchAccountNamesByAddress({
        sourceAccounts: [
          { name: 'Account 1', address },
          { name: 'Ledger Main', address },
        ],
        targetAccounts: [
          {
            indexedAccountId: 'hw-1--0',
            currentName: 'Account 1',
            address,
          },
        ],
      }),
    ).toEqual([
      {
        indexedAccountId: 'hw-1--0',
        currentName: 'Account 1',
        sourceName: 'Ledger Main',
        sourceNames: ['Ledger Main'],
        matchedAddress: address,
      },
    ]);
  });

  it('does not suggest a no-op rename', () => {
    const address = 'bc1qexample';
    expect(
      matchAccountNamesByAddress({
        sourceAccounts: [{ name: 'Bitcoin #1', address }],
        targetAccounts: [
          {
            indexedAccountId: 'hw-1--0',
            currentName: 'Bitcoin #1',
            address,
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe('getTrezorSuiteDefaultAccountTitleFromPath', () => {
  it.each([
    ["m/84'/0'/0'/0/0", 'Bitcoin #1'],
    ["m/49'/0'/1'/0/0", 'Bitcoin #2'],
    ["m/44'/0'/2'", 'Bitcoin #3'],
    ["m/86'/0'/9'/0/0", 'Bitcoin #10'],
  ])('maps supported Bitcoin paths like Trezor Suite: %s', (path, title) => {
    expect(getTrezorSuiteDefaultAccountTitleFromPath(path)).toBe(title);
  });

  it.each([
    "m/84'/2'/0'/0/0",
    "m/48'/0'/0'/0/0",
    "m/84'/0'/0'/1/0",
    'not-a-path',
  ])(
    'rejects paths that are not Trezor Suite BTC receive paths: %s',
    (path) => {
      expect(getTrezorSuiteDefaultAccountTitleFromPath(path)).toBeUndefined();
    },
  );
});

describe('getTrezorSuiteBtcReceivePath', () => {
  it.each([
    ["m/84'/0'/0'", "m/84'/0'/0'/0/0"],
    ["m/49'/0'/2'/0/0", "m/49'/0'/2'/0/0"],
  ])('builds the full first receive path: %s', (path, receivePath) => {
    expect(getTrezorSuiteBtcReceivePath(path)).toBe(receivePath);
  });

  it.each(["m/84'/2'/0'", "m/84'/0'/0'/1/0", 'not-a-path'])(
    'rejects unsupported receive paths: %s',
    (path) => {
      expect(getTrezorSuiteBtcReceivePath(path)).toBeUndefined();
    },
  );
});
