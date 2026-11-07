/* eslint-disable import/first */

const mockGetHeadlessBuyToken = jest.fn<
  Promise<IFiatCryptoToken | undefined>,
  [unknown]
>();
const mockNavigate = jest.fn<void, [unknown, unknown]>();
const mockEntryDecided = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceFiatCrypto: {
      getHeadlessBuyToken: (params: unknown) => mockGetHeadlessBuyToken(params),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $navigationRef: {
      current: {
        navigate: (name: unknown, params: unknown) =>
          mockNavigate(name, params),
      },
    },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/onramper/canUseHeadless',
  () => ({ canUseHeadless: () => true }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    fiatCrypto: {
      onramper: {
        entryDecided: (params: unknown) => mockEntryDecided(params),
      },
    },
  },
}));

import { EHeadlessBuyEntry } from '@onekeyhq/shared/types/fiatCrypto';
import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';

import { tryOpenHeadlessBuy } from './openFiatCryptoOrHeadless';

const NOW = 1_800_000_000_000;

function buildToken(overrides: Partial<IFiatCryptoToken>): IFiatCryptoToken {
  return {
    networkId: 'evm--1',
    address: '',
    symbol: 'ETH',
    onramperNetworkCode: 'ethereum',
    headlessSupported: true,
    ...overrides,
  } as IFiatCryptoToken;
}

// What the server says for this request's IP right now.
const SERVER_SUPPORTED = buildToken({ headlessSupported: true });
const SERVER_UNSUPPORTED = buildToken({ headlessSupported: false });

function open(params: { token?: IFiatCryptoToken; tokenFetchedAt?: number }) {
  return tryOpenHeadlessBuy({
    networkId: 'evm--1',
    tokenAddress: '',
    accountId: 'account',
    entryFrom: EHeadlessBuyEntry.BuyTokenList,
    ...params,
  });
}

function openedToken(): IFiatCryptoToken | undefined {
  const call = mockNavigate.mock.calls[0] as
    | [unknown, { params: { params: { token: IFiatCryptoToken } } }]
    | undefined;
  return call?.[1].params.params.token;
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockGetHeadlessBuyToken.mockReset();
  mockNavigate.mockReset();
  mockEntryDecided.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('tryOpenHeadlessBuy region flag freshness', () => {
  it('trusts a list row fetched moments ago without another request', async () => {
    const row = buildToken({ headlessSupported: true });

    await expect(
      open({ token: row, tokenFetchedAt: NOW - 10_000 }),
    ).resolves.toBe(true);

    expect(mockGetHeadlessBuyToken).not.toHaveBeenCalled();
    expect(openedToken()).toBe(row);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'native', tokenSource: 'row' }),
    );
  });

  // The buy list paints a persisted snapshot first: its rows carry the region
  // flag of whatever IP fetched them, possibly days ago.
  it('asks the server again for a row of unknown age, and goes native when the region is supported now', async () => {
    mockGetHeadlessBuyToken.mockResolvedValue(SERVER_SUPPORTED);
    const snapshotRow = buildToken({ headlessSupported: false });

    await expect(open({ token: snapshotRow })).resolves.toBe(true);

    expect(mockGetHeadlessBuyToken).toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '',
      accountId: 'account',
    });
    expect(openedToken()).toBe(SERVER_SUPPORTED);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'native', tokenSource: 'lookup' }),
    );
  });

  it('asks the server again for a row that sat on screen, and stays on the web when the region is no longer supported', async () => {
    mockGetHeadlessBuyToken.mockResolvedValue(SERVER_UNSUPPORTED);
    const oldRow = buildToken({ headlessSupported: true });

    await expect(
      open({ token: oldRow, tokenFetchedAt: NOW - 61_000 }),
    ).resolves.toBe(false);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'web',
        reason: 'headlessNotSupported',
        tokenSource: 'lookup',
      }),
    );
  });

  it('decides from the row it has when the server cannot be asked', async () => {
    mockGetHeadlessBuyToken.mockRejectedValue(new Error('Network error'));
    const oldRow = buildToken({ headlessSupported: true });

    await expect(
      open({ token: oldRow, tokenFetchedAt: NOW - 61_000 }),
    ).resolves.toBe(true);

    expect(openedToken()).toBe(oldRow);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'native', tokenSource: 'staleRow' }),
    );
  });

  it('still leaves the tap to the web widget when a direct entry cannot resolve its token', async () => {
    mockGetHeadlessBuyToken.mockRejectedValue(new Error('Network error'));

    await expect(open({})).resolves.toBe(false);

    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'web', reason: 'tokenLookupFailed' }),
    );
  });
});

// A list request times out after 30 s. A tapped row must not sit there that
// long with nothing on screen, then open the page after the user has left.
describe('tryOpenHeadlessBuy region flag re-check deadline', () => {
  const RECHECK_TIMEOUT_MS = 5000;

  function answerAfter(ms: number, token: IFiatCryptoToken) {
    mockGetHeadlessBuyToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(token), ms);
        }),
    );
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops waiting for the server after five seconds and decides from the row', async () => {
    answerAfter(RECHECK_TIMEOUT_MS + 1000, SERVER_UNSUPPORTED);
    const oldRow = buildToken({ headlessSupported: true });
    const opening = open({ token: oldRow, tokenFetchedAt: NOW - 61_000 });

    await jest.advanceTimersByTimeAsync(RECHECK_TIMEOUT_MS - 1);
    expect(mockNavigate).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    await expect(opening).resolves.toBe(true);
    expect(openedToken()).toBe(oldRow);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'native', tokenSource: 'staleRow' }),
    );

    // The answer that lands afterwards changes nothing.
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockEntryDecided).toHaveBeenCalledTimes(1);
  });

  it('uses an answer that lands within the deadline', async () => {
    answerAfter(RECHECK_TIMEOUT_MS - 1000, SERVER_UNSUPPORTED);
    const oldRow = buildToken({ headlessSupported: true });
    const opening = open({ token: oldRow, tokenFetchedAt: NOW - 61_000 });

    await jest.advanceTimersByTimeAsync(RECHECK_TIMEOUT_MS - 1000);
    await expect(opening).resolves.toBe(false);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'headlessNotSupported',
        tokenSource: 'lookup',
      }),
    );
  });

  // Without a row there is nothing to fall back on: the direct-buy entries
  // keep waiting for their lookup as before.
  it('keeps a direct entry waiting for its lookup past the deadline', async () => {
    answerAfter(RECHECK_TIMEOUT_MS + 3000, SERVER_SUPPORTED);
    const opening = open({});

    await jest.advanceTimersByTimeAsync(RECHECK_TIMEOUT_MS);
    expect(mockEntryDecided).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(3000);
    await expect(opening).resolves.toBe(true);
    expect(mockEntryDecided).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'native', tokenSource: 'lookup' }),
    );
  });
});
