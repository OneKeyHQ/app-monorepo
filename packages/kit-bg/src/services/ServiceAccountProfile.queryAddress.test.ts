/*
yarn jest packages/kit-bg/src/services/ServiceAccountProfile.queryAddress.test.ts

Latency guard for the recipient AddressInput:

`queryAddress` used to run `/wallet/v1/account/validate-address` and
`/wallet/v1/account/badges` strictly one after the other, so the input spinner
lasted the sum of both round trips (~1.1 s observed). Once the local validator
accepts the input, the badges request no longer depends on the server
validation result, so it is started speculatively and awaited later. These
tests pin that ordering and the cases where speculation must NOT fire.
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
  OneKeyLocalError: Error,
}));

jest.mock('@onekeyhq/shared/src/utils/cexDepositSupportUtils', () => ({
  mergeCexSupportedInfo: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/promiseUtils', () => ({
  promiseAllSettledEnhanced: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
    isEvmNetwork: ({ networkId }: { networkId: string }) =>
      networkId.startsWith('evm--'),
    isBTCNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOwnAccount: () => false,
    isWatchingAccount: () => false,
    isOthersAccount: () => false,
    isSimilarAddress: () => false,
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {},
}));

jest.mock('../vaults/impls/btc/sdkBtc/findAddressUtils', () => ({
  mergeClaimedUtxos: jest.fn(),
}));

jest.mock('../states/jotai/atoms', () => ({
  activeAccountValueAtom: { get: jest.fn(), set: jest.fn() },
  currencyPersistAtom: { get: jest.fn() },
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

/* eslint-disable import/first, import/order */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAddressInteractionStatus,
  EServerInteractedStatus,
} from '@onekeyhq/shared/types/address';
import type { IServerAccountBadgeResp } from '@onekeyhq/shared/types/address';

import ServiceAccountProfile from './ServiceAccountProfile';

/* eslint-enable import/first, import/order */

const NETWORK_ID = 'evm--1';
const ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const SENDER = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0xF501EECfc96Aa9f9393BbEDf4f324bf33d4ABafa';

const VALIDATE_PATH = '/wallet/v1/account/validate-address';
const BADGES_PATH = '/wallet/v1/account/badges';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Let every already-queued microtask (and the ones they queue) settle.
async function flushMicrotasks() {
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

// Node only emits `unhandledRejection` after the microtask queue drains and
// control returns to the event loop, so assertions on it need a macrotask
// boundary, not just microtask flushes.
async function flushMacrotask() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function makeService({
  localValid = true,
  badgesResp = {
    interacted: EServerInteractedStatus.TRUE,
    badges: [{ type: 'success', label: 'ok' }],
  },
  getAccount,
}: {
  localValid?: boolean;
  badgesResp?: Partial<IServerAccountBadgeResp>;
  getAccount?: jest.Mock;
} = {}) {
  const validate = deferred<'valid' | 'invalid'>();
  const clientGet = jest.fn(async (path: string) => {
    if (path === BADGES_PATH) {
      return { data: { data: badgesResp } };
    }
    throw new OneKeyLocalError(`unexpected GET ${path}`);
  });

  const backgroundApi = {
    serviceValidator: {
      localValidateAddress: jest.fn(async () => ({
        isValid: localValid,
        displayAddress: localValid ? RECIPIENT : '',
        normalizedAddress: localValid ? RECIPIENT : '',
      })),
      // Stands in for the server round trip; the test decides when it settles.
      validateAddress: jest.fn(() => validate.promise),
    },
    serviceNetwork: {
      isCustomNetwork: jest.fn(async () => false),
    },
    serviceAccount: {
      getAccount:
        getAccount ??
        jest.fn(async () => ({ address: SENDER, id: ACCOUNT_ID })),
      safeGetAccountXpubsForAllDeriveTypes: jest.fn(async () => []),
      getAccountNameFromAddress: jest.fn(async () => []),
    },
    serviceAddressBook: {
      findItem: jest.fn(async () => undefined),
      getItemsByNetwork: jest.fn(async () => []),
    },
    serviceHistory: {
      fetchTransferRecipients: jest.fn(async () => ({ data: [] })),
      getAccountsLocalHistoryTxs: jest.fn(async () => []),
    },
    serviceSetting: {
      getIsEnableTransferAllowList: jest.fn(async () => false),
    },
  };

  const service = new ServiceAccountProfile({ backgroundApi } as any);
  (service as any).getClient = jest.fn(async () => ({ get: clientGet }));

  return { service, backgroundApi, clientGet, validate };
}

const baseArgs = {
  networkId: NETWORK_ID,
  address: RECIPIENT,
  accountId: ACCOUNT_ID,
  enableAddressBook: true,
  enableWalletName: true,
  enableAddressInteractionStatus: true,
  enableAddressContract: true,
};

describe('ServiceAccountProfile.queryAddress request overlap', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it('starts the badges request before server validation settles', async () => {
    const { service, backgroundApi, clientGet, validate } = makeService();

    const pending = service.queryAddress(baseArgs);
    await flushMicrotasks();

    // Server validation is still in flight...
    expect(
      backgroundApi.serviceValidator.validateAddress,
    ).toHaveBeenCalledTimes(1);
    // ...and the badges request must already be on the wire.
    expect(clientGet.mock.calls.map(([path]) => path)).toContain(BADGES_PATH);

    validate.resolve('valid');
    const result = await pending;

    expect(result.validStatus).toBe('valid');
    expect(result.addressBadges).toEqual([{ type: 'success', label: 'ok' }]);
    expect(result.addressInteractionStatus).toBe(
      EAddressInteractionStatus.INTERACTED,
    );
    // The speculative response is reused; no second badges round trip.
    expect(
      clientGet.mock.calls.filter(([path]) => path === BADGES_PATH),
    ).toHaveLength(1);
    expect(clientGet.mock.calls.map(([path]) => path)).not.toContain(
      VALIDATE_PATH,
    );
  });

  it('drops the speculative badges result when server validation rejects the address', async () => {
    const { service, clientGet, validate } = makeService();

    const pending = service.queryAddress(baseArgs);
    await flushMicrotasks();
    validate.resolve('invalid');
    const result = await pending;

    expect(result.validStatus).toBe('invalid');
    expect(result.addressBadges).toBeUndefined();
    expect(result.addressInteractionStatus).toBeUndefined();
    // Speculation is allowed to have fired; it just must not leak into result.
    expect(
      clientGet.mock.calls.filter(([path]) => path === BADGES_PATH).length,
    ).toBeLessThanOrEqual(1);
  });

  it('does not surface an unhandled rejection when the unused speculative request fails', async () => {
    const getAccount = jest.fn(async () => {
      throw new OneKeyLocalError('db unavailable');
    });
    const { service, validate } = makeService({ getAccount });

    const pending = service.queryAddress(baseArgs);
    await flushMicrotasks();
    validate.resolve('invalid');
    const result = await pending;
    // A rejection only becomes "unhandled" once Node reaches the event loop.
    await flushMacrotask();

    expect(result.validStatus).toBe('invalid');
    expect(unhandled).toHaveLength(0);
  });

  it('does not fire badges speculatively for input the local validator rejects', async () => {
    const { service, clientGet, validate } = makeService({ localValid: false });

    const pending = service.queryAddress(baseArgs);
    await flushMicrotasks();

    expect(clientGet).not.toHaveBeenCalled();

    validate.resolve('invalid');
    const result = await pending;
    expect(result.validStatus).toBe('invalid');
    expect(clientGet).not.toHaveBeenCalled();
  });

  it('does not fire badges when neither contract nor interaction checks are enabled', async () => {
    const { service, clientGet, validate } = makeService();

    const pending = service.queryAddress({
      ...baseArgs,
      enableAddressContract: false,
      enableAddressInteractionStatus: false,
    });
    await flushMicrotasks();
    validate.resolve('valid');
    await pending;

    expect(clientGet).not.toHaveBeenCalled();
  });
});
