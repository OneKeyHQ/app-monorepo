/*
yarn test packages/kit-bg/src/services/ServiceAccountProfile.updateAllNetworkAccountValue.test.ts

Regression guard for the menu-bar tray "$0.00 after account round-trip on a
single-chain view" bug:

`activeAccountValueAtom` is consumed by cross-network readers (desktop tray,
account selector active row) that sum the map filtered by the All-Networks
enabled set. On a single-chain home view each refresh calls
`updateAllNetworkAccountValue` with a ONE-network map and no `updateAll`.
While the atom still belongs to the same account this merges and the
cross-network entries survive; but after an account switch the accountId
mismatch used to REPLACE the atom with the partial map, so the tray summed a
single network — and $0.00 whenever that network is disabled in All-Networks.
The fix seeds the replace branch from the persisted SimpleDb per-network
values before overlaying the fresh partial map.
*/

// --- mocks MUST be defined before the import of ServiceAccountProfile below ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {},
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: (m: { id: string }) => m.id } },
}));

jest.mock('@onekeyhq/shared/src/request/utils', () => ({
  parseRPCResponse: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  // Only constructed, never inspected — plain Error is enough.
  OneKeyLocalError: Error,
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
  },
}));

// Faithful copies of the real key helpers so compound-key round-trips behave
// like production; only the account-shape predicates are simplified.
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersAccount: ({ accountId }: { accountId: string }) =>
      accountId.startsWith('imported--') ||
      accountId.startsWith('watching--') ||
      accountId.startsWith('external--'),
    buildAccountValueKey: ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => `${accountId}_${networkId}`,
    parseAccountValueKey: ({ key }: { key: string }) => {
      const [accountId, networkId] = key.split('_');
      return { accountId, networkId };
    },
    pickXpubFromDBAccount: (acc: { xpub?: string } | undefined) => acc?.xpub,
    buildAccountLocalAssetsKey: ({
      accountAddress,
      xpub,
    }: {
      accountAddress?: string;
      xpub?: string;
    }) => `${accountAddress ?? ''}|${xpub ?? ''}`,
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {},
}));

jest.mock('../vaults/impls/btc/sdkBtc/findAddressUtils', () => ({
  mergeClaimedUtxos: jest.fn(),
}));

const mockAtomState: {
  current:
    | {
        accountId: string;
        value: Record<string, string> | string;
        currency: string;
      }
    | undefined;
} = { current: undefined };

jest.mock('../states/jotai/atoms', () => ({
  activeAccountValueAtom: {
    get: jest.fn(async () => mockAtomState.current),
    set: jest.fn(async (v: (typeof mockAtomState)['current']) => {
      mockAtomState.current = v;
    }),
  },
  currencyPersistAtom: {
    get: jest.fn(async () => ({
      currencyMap: { usd: { id: 'usd', value: 1 } },
    })),
  },
}));

type ISimpleDbAccountValueEntry =
  | { value?: Record<string, string>; currency?: 'usd' }
  | undefined;
const mockGetAllNetworkAccountsValue = jest.fn<
  Promise<ISimpleDbAccountValueEntry[]>,
  unknown[]
>(async () => []);
const mockSimpleDbUpdateAllNetworkAccountValue = jest.fn<
  Promise<void>,
  unknown[]
>(async () => undefined);

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    accountValue: {
      getAllNetworkAccountsValue: (...args: unknown[]) =>
        mockGetAllNetworkAccountsValue(...args),
      updateAllNetworkAccountValue: (...args: unknown[]) =>
        mockSimpleDbUpdateAllNetworkAccountValue(...args),
    },
  },
}));

// eslint-disable-next-line import/first, import/order
import ServiceAccountProfile from './ServiceAccountProfile';

const TRON_ID = 'tron--0x2b6653dc';
const EVM_ID = 'evm--1';

const INDEXED_A = 'hd-1--1';
const INDEXED_B = 'hd-1--0';
const TRON_ACCOUNT_A = "hd-1--m/44'/195'/0'/0/1";
const EVM_ACCOUNT_A = "hd-1--m/44'/60'/0'/0/1";
const TRON_ACCOUNT_B = "hd-1--m/44'/195'/0'/0/0";

function makeService({
  accountsInSameIndexedAccountId = {},
}: {
  accountsInSameIndexedAccountId?: Record<
    string,
    Array<{ id: string; address?: string; xpub?: string }>
  >;
} = {}) {
  const backgroundApi = {
    serviceAccount: {
      getAccountXpub: jest.fn(async () => undefined),
      getAccountAddressForApi: jest.fn(async () => 'mock-address'),
      getAccountsInSameIndexedAccountId: jest.fn(
        async ({ indexedAccountId }: { indexedAccountId: string }) => ({
          accounts: accountsInSameIndexedAccountId[indexedAccountId] ?? [],
        }),
      ),
      getDBAccountSafe: jest.fn(async () => undefined),
    },
    serviceRookieGuide: {
      checkAndRecordDepositTask: jest.fn(async () => undefined),
    },
  };
  return new ServiceAccountProfile({ backgroundApi } as any);
}

describe('ServiceAccountProfile.updateAllNetworkAccountValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAtomState.current = undefined;
    mockGetAllNetworkAccountsValue.mockReset();
    mockSimpleDbUpdateAllNetworkAccountValue.mockReset();
  });

  it('seeds the atom from persisted per-network values when the atom belongs to another account (single-chain account switch)', async () => {
    // Atom still holds the previously active account's partial map.
    mockAtomState.current = {
      accountId: INDEXED_B,
      value: { [`${TRON_ACCOUNT_B}_${TRON_ID}`]: '0' },
      currency: 'usd',
    };

    // Persisted SimpleDb values for the switched-to account: one entry per
    // derive account, keyed by networkId (SimpleDb shape).
    mockGetAllNetworkAccountsValue.mockResolvedValue([
      { value: { [TRON_ID]: '4.17' }, currency: 'usd' },
      { value: { [EVM_ID]: '55' }, currency: 'usd' },
    ]);

    const service = makeService({
      accountsInSameIndexedAccountId: {
        [INDEXED_A]: [
          { id: TRON_ACCOUNT_A, address: 'TAddrA' },
          { id: EVM_ACCOUNT_A, address: '0xA' },
        ],
      },
    });

    // Single-chain home refresh: only the tron entry, no updateAll.
    await service.updateAllNetworkAccountValue({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });

    expect(mockAtomState.current).toEqual({
      accountId: INDEXED_A,
      value: {
        // Fresh single-chain write wins for its own key…
        [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17',
        // …and the other chains' persisted values survive so cross-network
        // consumers (tray / account selector) don't collapse to one network.
        [`${EVM_ACCOUNT_A}_${EVM_ID}`]: '55',
      },
      currency: 'usd',
    });
  });

  it('merges in-memory without reading SimpleDb when the atom already belongs to the account', async () => {
    mockAtomState.current = {
      accountId: INDEXED_A,
      value: { [`${EVM_ACCOUNT_A}_${EVM_ID}`]: '55' },
      currency: 'usd',
    };

    const service = makeService();

    await service.updateAllNetworkAccountValue({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });

    expect(mockAtomState.current).toEqual({
      accountId: INDEXED_A,
      value: {
        [`${EVM_ACCOUNT_A}_${EVM_ID}`]: '55',
        [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17',
      },
      currency: 'usd',
    });
    expect(mockGetAllNetworkAccountsValue).not.toHaveBeenCalled();
  });

  it('replaces the atom without seeding when updateAll is set (authoritative all-networks refresh)', async () => {
    mockAtomState.current = {
      accountId: INDEXED_A,
      value: { [`${EVM_ACCOUNT_A}_${EVM_ID}`]: '55' },
      currency: 'usd',
    };

    const service = makeService();

    await service.updateAllNetworkAccountValue({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
      updateAll: true,
    });

    expect(mockAtomState.current).toEqual({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });
    expect(mockGetAllNetworkAccountsValue).not.toHaveBeenCalled();
  });

  it('keeps the atom write alive when persisted seeding finds nothing', async () => {
    mockAtomState.current = {
      accountId: INDEXED_B,
      value: { [`${TRON_ACCOUNT_B}_${TRON_ID}`]: '0' },
      currency: 'usd',
    };
    mockGetAllNetworkAccountsValue.mockResolvedValue([]);

    const service = makeService({
      accountsInSameIndexedAccountId: { [INDEXED_A]: [] },
    });

    await service.updateAllNetworkAccountValue({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });

    expect(mockAtomState.current).toEqual({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });
  });

  // `activeAccountValueAtom` write ordering is covered above; the SimpleDb
  // persistence write path is unchanged and exercised implicitly.
  it('still persists the incoming values to SimpleDb', async () => {
    mockGetAllNetworkAccountsValue.mockResolvedValue([]);
    const service = makeService({
      accountsInSameIndexedAccountId: { [INDEXED_A]: [] },
    });

    await service.updateAllNetworkAccountValue({
      accountId: INDEXED_A,
      value: { [`${TRON_ACCOUNT_A}_${TRON_ID}`]: '4.17' },
      currency: 'usd',
    });

    expect(mockSimpleDbUpdateAllNetworkAccountValue).toHaveBeenCalledWith({
      items: [
        {
          accountAddress: 'mock-address',
          xpub: undefined,
          networkId: TRON_ID,
          value: '4.17',
        },
      ],
      currency: 'usd',
      updateAll: undefined,
    });
  });
});
