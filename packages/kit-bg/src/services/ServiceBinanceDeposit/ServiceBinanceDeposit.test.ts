import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositAsset,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalSession,
} from '@onekeyhq/shared/types/binanceDeposit';

import ServiceBinanceDeposit from './ServiceBinanceDeposit';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

const mockClient = {
  post: jest.fn(),
};

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }

    async getClient() {
      return mockClient;
    }
  },
}));

const mockSecureItems = new Map<string, string>();

jest.mock(
  '@onekeyhq/shared/src/storage/instance/secureStorageInstance',
  () => ({
    __esModule: true,
    default: {
      getSecureItem: async (key: string) => mockSecureItems.get(key) ?? null,
      setSecureItem: async (key: string, value: string) => {
        mockSecureItems.set(key, value);
      },
      removeSecureItem: async (key: string) => {
        mockSecureItems.delete(key);
      },
    },
  }),
);

jest.mock('../../states/jotai/atoms', () => ({
  devSettingsPersistAtom: { get: async () => ({ enabled: false }) },
}));

const LOCAL_ID = 'local-1';
const SESSION_ID = 'a'.repeat(64);
const SESSION_KEY = 'k'.repeat(43);
const SESSION_KEY_STORAGE_KEY = `onekey_bcd_sk.${LOCAL_ID}`;
const ADDRESS = '0x1111111111111111111111111111111111111111';

const ASSET: IBinanceDepositAsset = {
  networkId: 'evm--42161',
  cryptoCurrency: 'ETH',
  requiresAddressTag: false,
};

const DESTINATION: IBinanceDepositAuthorizedDestination = {
  networkId: ASSET.networkId,
  binanceNetwork: 'ARBITRUM',
  cryptoCurrency: ASSET.cryptoCurrency,
  address: ADDRESS,
  authorizedAt: 1,
};

function buildAuthorizedSession(
  patch: Partial<IBinanceDepositLocalSession> = {},
): IBinanceDepositLocalSession {
  return {
    localId: LOCAL_ID,
    sessionId: SESSION_ID,
    networkId: ASSET.networkId,
    cryptoCurrency: ASSET.cryptoCurrency,
    requiresAddressTag: false,
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    destination: DESTINATION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...patch,
  };
}

function buildView(patch: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    networkId: ASSET.networkId,
    cryptoCurrency: ASSET.cryptoCurrency,
    authorizedDestination: DESTINATION,
    ...patch,
  };
}

function answer(data: unknown) {
  return { data: { code: 0, data } };
}

function refuse(code: number) {
  return { data: { code } };
}

const NEW_SESSION_ID = 'c'.repeat(64);

function initView(patch: Record<string, unknown> = {}) {
  return {
    sessionId: NEW_SESSION_ID,
    status: EBinanceDepositSessionStatus.INIT,
    networkId: ASSET.networkId,
    cryptoCurrency: ASSET.cryptoCurrency,
    link: 'https://app.binance.com/deposit?x=1',
    ...patch,
  };
}

// Stands in for the vaults: TON writes one account as EQ… or UQ… depending
// on its bounce flag.
function normalizeForTest(address: string) {
  return address.replace(/^(EQ|UQ)/, 'ton:').toLowerCase();
}

function flushAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createService(
  session: IBinanceDepositLocalSession | undefined,
  {
    getBinanceSupportedAssets = jest.fn(),
    validateMemo = jest.fn(async (_params: unknown) => ({ isValid: true })),
    buildDecodedTx = jest.fn<
      Promise<{ nativeAmount?: string; actions: unknown[] }>,
      [unknown]
    >(),
  } = {},
) {
  let stored = session;
  const binanceDeposit = {
    getSession: async () => stored,
    setSession: async (next: IBinanceDepositLocalSession | undefined) => {
      stored = next;
    },
    clearSession: async (localId?: string) => {
      if (!stored || (localId && stored.localId !== localId)) {
        return undefined;
      }
      const removed = stored;
      stored = undefined;
      return removed;
    },
    updateSession: async (
      localId: string,
      updater: (s: IBinanceDepositLocalSession) => IBinanceDepositLocalSession,
    ) => {
      if (!stored || stored.localId !== localId) {
        return undefined;
      }
      stored = updater(stored);
      return stored;
    },
  };
  const service = new ServiceBinanceDeposit({
    backgroundApi: {
      simpleDb: { binanceDeposit },
      serviceToken: {
        _getBinanceSupportedAssetsMemo: { clear: jest.fn() },
        getBinanceSupportedAssets,
      },
      serviceSend: { validateMemo, buildDecodedTx },
      serviceValidator: {
        localValidateAddress: async ({ address }: { address: string }) => ({
          isValid: true,
          normalizedAddress: normalizeForTest(address),
          displayAddress: address,
        }),
      },
    },
  });
  return { service, getStored: () => stored };
}

function verify(
  service: ServiceBinanceDeposit,
  toAddress = ADDRESS,
): Promise<void> {
  return service.verifyBeforeSign({ localId: LOCAL_ID, toAddress });
}

describe('ServiceBinanceDeposit.discardSession', () => {
  beforeEach(() => {
    mockSecureItems.clear();
  });

  it('removes the session and its key', async () => {
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
    const { service, getStored } = createService(buildAuthorizedSession());

    await service.discardSession(LOCAL_ID);

    expect(getStored()).toBeUndefined();
    expect(mockSecureItems.has(SESSION_KEY_STORAGE_KEY)).toBe(false);
  });

  it('leaves a session that replaced the one being discarded', async () => {
    const replacement = buildAuthorizedSession({ localId: 'local-2' });
    mockSecureItems.set('onekey_bcd_sk.local-2', SESSION_KEY);
    const { service, getStored } = createService(replacement);

    await service.discardSession(LOCAL_ID);

    expect(getStored()).toBe(replacement);
    expect(mockSecureItems.has('onekey_bcd_sk.local-2')).toBe(true);
  });
});

describe('ServiceBinanceDeposit released address tag', () => {
  const XRP_ADDRESS = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';
  const xrpSession = (): IBinanceDepositLocalSession => ({
    localId: LOCAL_ID,
    sessionId: SESSION_ID,
    networkId: 'xrp--0',
    cryptoCurrency: 'XRP',
    requiresAddressTag: true,
    status: EBinanceDepositSessionStatus.INIT,
    linkOpenedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const xrpView = (addressTag: string) =>
    answer({
      sessionId: SESSION_ID,
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      networkId: 'xrp--0',
      cryptoCurrency: 'XRP',
      authorizedDestination: {
        networkId: 'xrp--0',
        binanceNetwork: 'XRP',
        cryptoCurrency: 'XRP',
        address: XRP_ADDRESS,
        addressTag,
        authorizedAt: 1,
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockReset();
    mockSecureItems.clear();
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
  });

  it('releases a tag that passes the chain memo rule', async () => {
    const validateMemo = jest.fn(async (_params: unknown) => ({
      isValid: true,
    }));
    const { service } = createService(xrpSession(), { validateMemo });
    mockClient.post.mockResolvedValue(xrpView('123456'));

    const snapshot = await service.getSnapshot(LOCAL_ID);

    expect(validateMemo).toHaveBeenCalledWith({
      networkId: 'xrp--0',
      memo: '123456',
      tokenAddress: undefined,
    });
    expect(snapshot?.phase).toBe('authorized');
    expect(snapshot?.destination?.addressTag).toBe('123456');
  });

  it('closes the session as a conflict when the chain rejects the tag', async () => {
    const validateMemo = jest.fn(async (_params: unknown) => ({
      isValid: false,
    }));
    const { service, getStored } = createService(xrpSession(), {
      validateMemo,
    });
    mockClient.post.mockResolvedValue(xrpView('12 3'));

    const snapshot = await service.getSnapshot(LOCAL_ID);

    expect(snapshot?.phase).toBe('failed');
    expect(snapshot?.failReason).toBe('conflict');
    expect(snapshot?.destination).toBeUndefined();
    expect(getStored()?.destination).toBeUndefined();
    expect(mockSecureItems.has(SESSION_KEY_STORAGE_KEY)).toBe(false);
  });

  it('does not release a tag that could not be checked', async () => {
    const validateMemo = jest
      .fn<Promise<{ isValid: boolean }>, [unknown]>()
      .mockRejectedValue(new Error('vault unavailable'));
    const { service } = createService(xrpSession(), { validateMemo });
    mockClient.post.mockResolvedValue(xrpView('123456'));

    const snapshot = await service.getSnapshot(LOCAL_ID);

    expect(snapshot?.failReason).toBe('conflict');
    expect(snapshot?.destination).toBeUndefined();
  });
});

describe('ServiceBinanceDeposit.verifyBeforeSign minimum', () => {
  const UNSIGNED_TX = { encodedTx: {} } as never;
  const TOKEN = '0x3333333333333333333333333333333333333333';
  const withMinimum = (patch: Partial<IBinanceDepositLocalSession> = {}) =>
    buildAuthorizedSession({
      destination: { ...DESTINATION, minAmount: '0.001' },
      ...patch,
    });
  const tokenSession = (minAmount?: string) =>
    buildAuthorizedSession({
      contractAddress: TOKEN,
      destination: { ...DESTINATION, contractAddress: TOKEN, minAmount },
    });
  const tokenView = (minAmount?: string) =>
    buildView({
      contractAddress: TOKEN,
      authorizedDestination: {
        ...DESTINATION,
        contractAddress: TOKEN,
        minAmount,
      },
    });
  const decodedAs = (nativeAmount: string) =>
    jest
      .fn<Promise<{ nativeAmount?: string; actions: unknown[] }>, [unknown]>()
      .mockResolvedValue({ nativeAmount, actions: [] });
  const verifyTx = (service: ServiceBinanceDeposit, amount?: string) =>
    service.verifyBeforeSign({
      localId: LOCAL_ID,
      toAddress: ADDRESS,
      accountId: 'hd-1--0',
      unsignedTx: UNSIGNED_TX,
      amount,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockReset();
    mockSecureItems.clear();
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
    // The server still releases the address, and names no other minimum.
    mockClient.post.mockResolvedValue(answer(buildView()));
  });

  it('stops a native transfer the prepared transaction leaves below the minimum', async () => {
    const buildDecodedTx = decodedAs('0.0009');
    const { service, getStored } = createService(withMinimum(), {
      buildDecodedTx,
    });

    // The amount page held the whole balance; the transaction sends less.
    await expect(verifyTx(service, '0.0012')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    expect(buildDecodedTx).toHaveBeenCalledWith({
      networkId: ASSET.networkId,
      accountId: 'hd-1--0',
      unsignedTx: UNSIGNED_TX,
    });
    // Nothing is wrong with the address: the session stays.
    expect(getStored()?.failReason).toBeUndefined();
    expect(getStored()?.destination).toBeDefined();
  });

  it('passes when the prepared amount meets the minimum', async () => {
    const { service } = createService(withMinimum(), {
      buildDecodedTx: decodedAs('0.001'),
    });

    await expect(verifyTx(service)).resolves.toBeUndefined();

    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it('asks to confirm again when the prepared transaction cannot be read', async () => {
    const buildDecodedTx = jest
      .fn<Promise<{ nativeAmount?: string; actions: unknown[] }>, [unknown]>()
      .mockRejectedValue(new Error('decode failed'));
    const { service, getStored } = createService(withMinimum(), {
      buildDecodedTx,
    });

    await expect(verifyTx(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });

    expect(getStored()?.failReason).toBeUndefined();
  });

  it('reads the amount from the transfer actions when the decode names no total', async () => {
    const transfer = (nativeAmount: string) => ({
      type: 'ASSET_TRANSFER',
      assetTransfer: { from: 'a', to: ADDRESS, sends: [], nativeAmount },
    });
    const below = createService(withMinimum(), {
      buildDecodedTx: jest
        .fn<Promise<{ nativeAmount?: string; actions: unknown[] }>, [unknown]>()
        .mockResolvedValue({
          actions: [transfer('0.0004'), transfer('0.0005')],
        }),
    });
    await expect(verifyTx(below.service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    const enough = createService(withMinimum(), {
      buildDecodedTx: jest
        .fn<Promise<{ nativeAmount?: string; actions: unknown[] }>, [unknown]>()
        .mockResolvedValue({
          actions: [transfer('0.0006'), transfer('0.0005')],
        }),
    });
    await expect(verifyTx(enough.service)).resolves.toBeUndefined();
  });

  it('asks to confirm again when the decode could not describe the transfer', async () => {
    const { service, getStored } = createService(withMinimum(), {
      buildDecodedTx: jest
        .fn<Promise<{ nativeAmount?: string; actions: unknown[] }>, [unknown]>()
        .mockResolvedValue({ actions: [{ type: 'UNKNOWN' }] }),
    });

    await expect(verifyTx(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });

    expect(getStored()?.failReason).toBeUndefined();
  });

  it('holds a token amount against the minimum without reading the transaction', async () => {
    const buildDecodedTx = decodedAs('0');
    const { service, getStored } = createService(tokenSession('5'), {
      buildDecodedTx,
    });
    mockClient.post.mockResolvedValue(answer(tokenView('5')));

    await expect(verifyTx(service, '4.99')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });
    await expect(verifyTx(service, '5')).resolves.toBeUndefined();

    expect(buildDecodedTx).not.toHaveBeenCalled();
    expect(getStored()?.failReason).toBeUndefined();
  });

  it('holds a token amount against a minimum the server raised, and keeps it', async () => {
    const { service, getStored } = createService(tokenSession('5'));
    mockClient.post.mockResolvedValue(answer(tokenView('8')));

    await expect(verifyTx(service, '6')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    // The amount page reads the new minimum from here when the user goes
    // back; the address itself still stands.
    expect(getStored()?.destination?.minAmount).toBe('8');
    expect(getStored()?.destination?.address).toBe(ADDRESS);
    expect(getStored()?.failReason).toBeUndefined();
    await expect(verifyTx(service, '8')).resolves.toBeUndefined();
  });

  it('holds a native amount against a minimum the server raised', async () => {
    const { service, getStored } = createService(withMinimum(), {
      buildDecodedTx: decodedAs('0.0015'),
    });
    mockClient.post.mockResolvedValue(
      answer(
        buildView({
          authorizedDestination: { ...DESTINATION, minAmount: '0.002' },
        }),
      ),
    );

    await expect(verifyTx(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    expect(getStored()?.destination?.minAmount).toBe('0.002');
  });

  it('holds the amount against a minimum the session did not have before', async () => {
    const { service, getStored } = createService(tokenSession());
    mockClient.post.mockResolvedValue(answer(tokenView('8')));

    await expect(verifyTx(service, '6')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    expect(getStored()?.destination?.minAmount).toBe('8');
  });

  it('keeps the minimum it holds when the answer names none', async () => {
    const { service, getStored } = createService(tokenSession('5'));
    mockClient.post.mockResolvedValue(answer(tokenView()));

    await expect(verifyTx(service, '4')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });

    expect(getStored()?.destination?.minAmount).toBe('5');
  });

  it('drops the minimum it holds when the answer names a zero', async () => {
    const { service, getStored } = createService(tokenSession('5'));
    mockClient.post.mockResolvedValue(answer(tokenView('0')));

    await expect(verifyTx(service, '4')).resolves.toBeUndefined();

    expect(getStored()?.destination?.minAmount).toBe('0');
  });

  it('holds what the confirm page left of a Max send, whatever the decode says', async () => {
    const verifyMax = (
      service: ServiceBinanceDeposit,
      nativeMaxSendAmount: string,
    ) =>
      service.verifyBeforeSign({
        localId: LOCAL_ID,
        toAddress: ADDRESS,
        accountId: 'hd-1--0',
        unsignedTx: UNSIGNED_TX,
        nativeMaxSendAmount,
      });
    // A decode that still reports the amount from before the fee was out.
    const { service } = createService(withMinimum(), {
      buildDecodedTx: decodedAs('0.0012'),
    });

    await expect(verifyMax(service, '0.0009')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });
    await expect(verifyMax(service, '0.001')).resolves.toBeUndefined();
    await expect(verifyMax(service, 'abc')).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });
  });

  it('holds a Max send against a minimum the server lowered', async () => {
    const { service, getStored } = createService(
      buildAuthorizedSession({
        destination: { ...DESTINATION, minAmount: '0.01' },
      }),
      { buildDecodedTx: decodedAs('0.0099') },
    );
    mockClient.post.mockResolvedValue(
      answer(
        buildView({
          authorizedDestination: { ...DESTINATION, minAmount: '0.009' },
        }),
      ),
    );

    await expect(
      service.verifyBeforeSign({
        localId: LOCAL_ID,
        toAddress: ADDRESS,
        accountId: 'hd-1--0',
        unsignedTx: UNSIGNED_TX,
        nativeMaxSendAmount: '0.0099',
      }),
    ).resolves.toBeUndefined();

    expect(getStored()?.destination?.minAmount).toBe('0.009');
  });

  it('falls back to the handed amount for a native transfer without its transaction', async () => {
    const { service } = createService(withMinimum());

    await expect(
      service.verifyBeforeSign({
        localId: LOCAL_ID,
        toAddress: ADDRESS,
        amount: '0.0009',
      }),
    ).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.BelowMinimum,
    });
  });

  it('checks no amount without a minimum, or with nothing to hold against it', async () => {
    const buildDecodedTx = decodedAs('0');
    const noMinimum = createService(buildAuthorizedSession(), {
      buildDecodedTx,
    });

    await expect(verifyTx(noMinimum.service, '0')).resolves.toBeUndefined();
    const nothingHanded = createService(withMinimum(), { buildDecodedTx });
    await expect(verify(nothingHanded.service)).resolves.toBeUndefined();

    expect(buildDecodedTx).not.toHaveBeenCalled();
  });

  it('does not read the amount when the server gives no verdict on the address', async () => {
    const buildDecodedTx = decodedAs('0.0009');
    const { service, getStored } = createService(withMinimum(), {
      buildDecodedTx,
    });
    mockClient.post.mockRejectedValue(new Error('offline'));

    await expect(verifyTx(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });

    expect(buildDecodedTx).not.toHaveBeenCalled();
    expect(getStored()?.failReason).toBeUndefined();
  });
});

describe('ServiceBinanceDeposit.verifyBeforeSign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockReset();
    mockSecureItems.clear();
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
  });

  it('passes when the server still releases the address the user saw', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(answer(buildView()));

    await expect(verify(service)).resolves.toBeUndefined();
    expect(getStored()?.failReason).toBeUndefined();
  });

  it('keeps the session when no answer comes back', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockRejectedValueOnce(new Error('timeout'));

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });
    expect(getStored()?.destination).toEqual(DESTINATION);
    expect(mockSecureItems.has(SESSION_KEY_STORAGE_KEY)).toBe(true);
  });

  it('keeps the session on a service error', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      refuse(EBinanceDepositErrorCode.ServiceError),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyUnavailable,
    });
    expect(getStored()?.failReason).toBeUndefined();
  });

  it('closes a session the server no longer knows as lost, not as a conflict', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      refuse(EBinanceDepositErrorCode.InvalidParams),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.DestinationInvalid,
    });
    expect(getStored()?.failReason).toBe('session_lost');
  });

  it.each([
    [EBinanceDepositSessionStatus.EXPIRED, 'expired'],
    [EBinanceDepositSessionStatus.REJECTED, 'rejected'],
  ])(
    'closes the session as it is (%s) instead of as a conflict',
    async (status, failReason) => {
      const { service, getStored } = createService(buildAuthorizedSession());
      mockClient.post.mockResolvedValueOnce(
        answer(buildView({ status, authorizedDestination: undefined })),
      );

      await expect(verify(service)).rejects.toMatchObject({
        code: EBinanceDepositLocalErrorCode.DestinationInvalid,
      });
      expect(getStored()?.failReason).toBe(failReason);
    },
  );

  it('treats a changed destination as a conflict', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      answer(
        buildView({
          authorizedDestination: {
            ...DESTINATION,
            address: '0x2222222222222222222222222222222222222222',
          },
        }),
      ),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
    expect(getStored()?.failReason).toBe('conflict');
  });

  it('treats a status that went back as a conflict', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      answer(
        buildView({
          status: EBinanceDepositSessionStatus.INIT,
          authorizedDestination: undefined,
        }),
      ),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
    expect(getStored()?.failReason).toBe('conflict');
  });

  it('stops a transfer to another address before asking the server', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());

    await expect(
      verify(service, '0x3333333333333333333333333333333333333333'),
    ).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(getStored()?.failReason).toBe('conflict');
  });

  it('accepts the address re-encoded by the amount page', async () => {
    const tonAddress = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG';
    const destination = {
      ...DESTINATION,
      networkId: 'ton--mainnet',
      address: tonAddress,
    };
    const { service, getStored } = createService(
      buildAuthorizedSession({ networkId: 'ton--mainnet', destination }),
    );
    mockClient.post.mockResolvedValueOnce(
      answer(
        buildView({
          networkId: 'ton--mainnet',
          authorizedDestination: destination,
        }),
      ),
    );

    await expect(
      verify(service, `UQ${tonAddress.slice(2)}`),
    ).resolves.toBeUndefined();
    expect(getStored()?.failReason).toBeUndefined();
  });

  it('treats a security refusal as a conflict', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      refuse(EBinanceDepositErrorCode.SecurityConflict),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
    expect(getStored()?.failReason).toBe('conflict');
  });

  it('passes a paused deposit on as such and keeps the session', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      refuse(EBinanceDepositErrorCode.DepositDisabled),
    );

    await expect(verify(service)).rejects.toMatchObject({
      code: EBinanceDepositErrorCode.DepositDisabled,
    });
    expect(getStored()?.destination).toEqual(DESTINATION);
  });

  it('reports a session that already ended by how it ended', async () => {
    const lost = createService(
      buildAuthorizedSession({ destination: undefined, failReason: 'expired' }),
    );
    await expect(verify(lost.service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.DestinationInvalid,
    });

    const conflict = createService(
      buildAuthorizedSession({
        destination: undefined,
        failReason: 'conflict',
      }),
    );
    await expect(verify(conflict.service)).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.VerifyFailed,
    });
    expect(mockClient.post).not.toHaveBeenCalled();
  });
});

describe('ServiceBinanceDeposit.startSession with a released address', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockReset();
    mockSecureItems.clear();
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
  });

  it('tells beforehand whether a start would pick up a released address', async () => {
    await expect(
      createService(buildAuthorizedSession()).service.hasResumableAddress(
        ASSET,
      ),
    ).resolves.toBe(true);
    await expect(
      createService(
        buildAuthorizedSession({
          status: EBinanceDepositSessionStatus.INIT,
          destination: undefined,
        }),
      ).service.hasResumableAddress(ASSET),
    ).resolves.toBe(false);
    await expect(
      createService(buildAuthorizedSession()).service.hasResumableAddress({
        ...ASSET,
        cryptoCurrency: 'USDC',
      }),
    ).resolves.toBe(false);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('picks the address up while the server still stands by it', async () => {
    const { service } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(answer(buildView()));

    const snapshot = await service.startSession(ASSET);

    expect(snapshot.phase).toBe('authorized');
    expect(snapshot.localId).toBe(LOCAL_ID);
    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockClient.post.mock.calls[0][0]).toContain('/query');
  });

  it('picks the address up when the check gets no answer', async () => {
    const { service } = createService(buildAuthorizedSession());
    mockClient.post.mockRejectedValueOnce(new Error('timeout'));

    const snapshot = await service.startSession(ASSET);

    expect(snapshot.phase).toBe('authorized');
    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it('goes back to Binance when the server no longer knows the session', async () => {
    const { service, getStored } = createService(buildAuthorizedSession());
    mockClient.post
      .mockResolvedValueOnce(refuse(EBinanceDepositErrorCode.InvalidParams))
      .mockResolvedValueOnce(
        answer({
          sessionId: 'b'.repeat(64),
          status: EBinanceDepositSessionStatus.INIT,
          networkId: ASSET.networkId,
          cryptoCurrency: ASSET.cryptoCurrency,
          link: 'https://app.binance.com/deposit?x=1',
        }),
      );

    const snapshot = await service.startSession(ASSET);

    expect(mockClient.post.mock.calls[1][0]).toMatch(/\/deposit\/sessions$/);
    expect(snapshot.phase).toBe('awaiting');
    expect(snapshot.localId).not.toBe(LOCAL_ID);
    expect(getStored()?.destination).toBeUndefined();
    expect(mockSecureItems.has(SESSION_KEY_STORAGE_KEY)).toBe(false);
  });

  it('stops on a conflict instead of starting over', async () => {
    const { service } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(
      answer(
        buildView({
          authorizedDestination: {
            ...DESTINATION,
            address: '0x2222222222222222222222222222222222222222',
          },
        }),
      ),
    );

    const snapshot = await service.startSession(ASSET);

    expect(snapshot.phase).toBe('failed');
    expect(snapshot.failReason).toBe('conflict');
    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it('starts over when the session key is gone', async () => {
    mockSecureItems.clear();
    const { service } = createService(buildAuthorizedSession());
    mockClient.post.mockResolvedValueOnce(answer(initView()));

    const snapshot = await service.startSession(ASSET);

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockClient.post.mock.calls[0][0]).toMatch(/\/deposit\/sessions$/);
    expect(snapshot.localId).not.toBe(LOCAL_ID);
    expect(snapshot.phase).toBe('awaiting');
  });
});

describe('ServiceBinanceDeposit creates', () => {
  const pendingSession = (createdAt = Date.now()) => ({
    localId: LOCAL_ID,
    networkId: ASSET.networkId,
    cryptoCurrency: ASSET.cryptoCurrency,
    requiresAddressTag: false,
    status: 'LOCAL_PENDING_CREATE' as const,
    createFailed: true,
    createdAt,
    updatedAt: createdAt,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.post.mockReset();
    mockSecureItems.clear();
    mockSecureItems.set(SESSION_KEY_STORAGE_KEY, SESSION_KEY);
  });

  it('refuses a start on a network the deposit is not offered on', async () => {
    const { service, getStored } = createService(undefined);

    for (const networkId of ['sui--mainnet', 'dot--polkadot', 'btc--0']) {
      await expect(
        service.startSession({
          networkId,
          cryptoCurrency: 'X',
          requiresAddressTag: false,
        }),
      ).rejects.toMatchObject({
        code: EBinanceDepositLocalErrorCode.InvalidState,
      });
    }

    expect(mockClient.post).not.toHaveBeenCalled();
    expect(getStored()).toBeUndefined();
  });

  it('runs a retry and a start one after another', async () => {
    const { service } = createService(pendingSession());
    let respond: (value: unknown) => void = () => undefined;
    mockClient.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );

    const retried = service.retryCreate(LOCAL_ID);
    const started = service.startSession(ASSET);
    await flushAsync();
    expect(mockClient.post).toHaveBeenCalledTimes(1);

    respond(answer(initView()));
    const [afterRetry, afterStart] = await Promise.all([retried, started]);

    // The start picks up the session the retry created.
    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(afterRetry.status).toBe(EBinanceDepositSessionStatus.INIT);
    expect(afterStart.localId).toBe(afterRetry.localId);
  });

  it('dates the session from the create that reached the server', async () => {
    const fortyMinutesAgo = Date.now() - 40 * 60 * 1000;
    const { service, getStored } = createService(
      pendingSession(fortyMinutesAgo),
    );
    mockClient.post.mockResolvedValueOnce(answer(initView()));

    await service.retryCreate(LOCAL_ID);

    expect(getStored()?.createdAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('keeps only a checked link from an INIT view', async () => {
    const initSession = buildAuthorizedSession({
      status: EBinanceDepositSessionStatus.INIT,
      destination: undefined,
    });
    const stale = createService(initSession);
    mockClient.post.mockResolvedValueOnce(
      answer(
        initView({
          sessionId: SESSION_ID,
          status: EBinanceDepositSessionStatus.CREATING,
          link: 'https://evil.example/x',
        }),
      ),
    );
    await expect(stale.service.prepareOpenLink(LOCAL_ID)).rejects.toMatchObject(
      { code: EBinanceDepositLocalErrorCode.InvalidState },
    );

    const fresh = createService(initSession);
    mockClient.post.mockResolvedValueOnce(
      answer(initView({ sessionId: SESSION_ID })),
    );
    await expect(fresh.service.prepareOpenLink(LOCAL_ID)).resolves.toEqual({
      link: 'https://app.binance.com/deposit?x=1',
    });
  });

  it('fails a list fetch without a toast', async () => {
    const { service } = createService(undefined, {
      getBinanceSupportedAssets: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('forbidden'), { autoToast: true }),
        ),
    });

    await expect(
      service.getDepositAsset({
        networkId: ASSET.networkId,
        symbol: 'ETH',
        isNative: true,
      }),
    ).rejects.toMatchObject({
      code: EBinanceDepositLocalErrorCode.RequestFailed,
      autoToast: false,
    });
  });
});
