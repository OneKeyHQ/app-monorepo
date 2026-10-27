import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAsset,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalSession,
} from '@onekeyhq/shared/types/exchange';

import ServiceBinanceDeposit from './ServiceBinanceDeposit';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

const mockClient = {
  post: jest.fn(),
};

jest.mock('./ServiceBase', () => ({
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

jest.mock('../states/jotai/atoms', () => ({
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

function createService(session: IBinanceDepositLocalSession | undefined) {
  let stored = session;
  const binanceDeposit = {
    getSession: async () => stored,
    setSession: async (next: IBinanceDepositLocalSession | undefined) => {
      stored = next;
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

describe('ServiceBinanceDeposit.verifyBeforeSign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
