import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockGetChainOnlyVault = jest.fn();
const mockGetVault = jest.fn();

jest.mock('../../factory', () => ({
  vaultFactory: {
    getChainOnlyVault: mockGetChainOnlyVault,
    getVault: mockGetVault,
  },
}));

const { getZcashLifecycleMutex, getZcashPrivacyModeOperationMutex } =
  jest.requireActual<typeof import('./lifecycle')>('./lifecycle');

const { ZcashPrivacyMode } =
  require('./privacyMode') as typeof import('./privacyMode');

const accountId = "hd-1--m/44'/133'/0'";

function createService({
  impl = 'zec',
  account = { id: accountId, impl: 'zec' },
  privacyModeEnabled = false,
}: {
  impl?: string;
  account?: { id: string; impl: string } | null;
  privacyModeEnabled?: boolean;
} = {}) {
  const backgroundApi = {
    serviceNetwork: {
      getNetworkSafe: jest.fn().mockResolvedValue({ id: 'zec--0', impl }),
    },
    serviceAccount: {
      getDBAccountSafe: jest.fn().mockResolvedValue(account),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest
        .fn()
        .mockResolvedValue({ password: 'test-password' }),
    },
    servicePrivacyChain: {
      onLocalWalletAccountsChanged: jest.fn(),
      // Enable checks the slot ceiling itself; direct callers skip the generic pre-check.
      assertEnabledAccountLimit: jest.fn(async () => undefined),
    },
    simpleDb: {
      zcash: {
        getPrivacyModeState: jest.fn().mockResolvedValue({ intent: 'off' }),
        isPrivacyModeEnabled: jest.fn().mockResolvedValue(privacyModeEnabled),
        beginPrivacyModeEnable: jest.fn(),
        completePrivacyModeEnable: jest.fn(),
        cancelPendingPrivacyModeEnables: jest.fn(),
        beginPrivacyModeDisable: jest.fn(),
        completePrivacyModeDisable: jest.fn(),
        getAccountMeta: jest.fn().mockResolvedValue({
          ufvk: 'synthetic-ufvk',
          birthdayHeight: 2_000_000,
        }),
      },
    },
  };
  return {
    backgroundApi,
    service: new ZcashPrivacyMode(
      backgroundApi as unknown as ConstructorParameters<
        typeof ZcashPrivacyMode
      >[0],
    ),
  };
}

describe('Zcash Privacy Mode context and receive gating', () => {
  beforeEach(() => {
    mockGetChainOnlyVault.mockReset();
    mockGetVault.mockReset();
  });

  it('rejects a non-Zcash network before writing privacy state', async () => {
    const { backgroundApi, service } = createService({ impl: 'btc' });

    await expect(
      service.enablePrivacyMode({
        networkId: 'btc--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('network is not compatible');
    expect(
      backgroundApi.servicePassword.promptPasswordVerifyByAccount,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('rejects a removed account before writing privacy state', async () => {
    const { backgroundApi, service } = createService({ account: null });

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('existing HD or hardware account');
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('rejects an HD account derived for another chain', async () => {
    const { backgroundApi, service } = createService({
      account: { id: accountId, impl: 'btc' },
    });

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('existing HD or hardware account');
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('does not expose a Unified Address while Privacy Mode is off', async () => {
    const getLocalWalletAccountMeta = jest.fn();
    mockGetChainOnlyVault.mockResolvedValue({ getLocalWalletAccountMeta });
    const { service } = createService({ privacyModeEnabled: false });

    await expect(
      service.getLocalWalletAccountMeta({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBeUndefined();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('returns viewing metadata only while Privacy Mode is enabled', async () => {
    const meta = { unifiedAddress: 'u1-test' };
    const getLocalWalletAccountMeta = jest.fn().mockResolvedValue(meta);
    mockGetChainOnlyVault.mockResolvedValue({ getLocalWalletAccountMeta });
    const { service } = createService({ privacyModeEnabled: true });

    await expect(
      service.getLocalWalletAccountMeta({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBe(meta);
  });

  // Holding the mutex would make an enable or disable look in flight.
  it('reads viewing metadata without taking the operation mutex', async () => {
    const lockedDuringRead: boolean[] = [];
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletAccountMeta: jest.fn(async () => {
        lockedDuringRead.push(
          getZcashPrivacyModeOperationMutex(accountId).isLocked(),
        );
        return { unifiedAddress: 'u1-test' };
      }),
    });
    const { service } = createService({ privacyModeEnabled: true });

    await service.getLocalWalletAccountMeta({ networkId: 'zec--0', accountId });

    expect(lockedDuringRead).toEqual([false]);
  });
});

// An enable can wait on a password or device prompt; address reads must not
// wait with it.
describe('Zcash Privacy Mode UI reads during an account operation', () => {
  it('answers without viewing metadata instead of queueing', async () => {
    const { service } = createService({ privacyModeEnabled: true });
    const release =
      await getZcashPrivacyModeOperationMutex(accountId).acquire();
    try {
      await expect(
        service.getLocalWalletAccountMeta({ networkId: 'zec--0', accountId }),
      ).resolves.toBeUndefined();
    } finally {
      release();
    }
  });
});

describe('Zcash Privacy Mode privacy lifecycle', () => {
  it('disables with a real non-reentrant lifecycle mutex and releases it for the next operation', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.zcash.getPrivacyModeState.mockResolvedValue({
      intent: 'on',
      birthdayHeight: 2_000_000,
    });
    const mutex = getZcashLifecycleMutex('synthetic-ufvk');
    const getSyncProgress = jest.fn(async () => {
      expect(mutex.isLocked()).toBe(true);
      return undefined;
    });
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        getSyncProgress,
      }),
    });

    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });
    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });

    expect(getSyncProgress).toHaveBeenCalledTimes(2);
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeDisable,
    ).toHaveBeenCalledTimes(2);
    expect(mutex.isLocked()).toBe(false);
  });

  it('prepares the enable rescan without starting a scan before admission', async () => {
    const { backgroundApi, service } = createService();
    // First enable: no viewing metadata yet, so derivation must run. The
    // second read is the post-derivation check inside the service.
    backgroundApi.simpleDb.zcash.getAccountMeta
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ ufvk: 'synthetic-ufvk', birthdayHeight: 2_000_000 });
    const syncGroup = jest
      .fn()
      .mockResolvedValue({ synced: true, backfillRemaining: true });
    const zcashRetryLocalWalletSetup = jest.fn();
    const zcashPreparePrivacyModeAccount = jest.fn(
      async ({ onPrepared }: { onPrepared: () => Promise<void> }) =>
        onPrepared(),
    );
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup,
      zcashPreparePrivacyModeAccount,
      getLocalWalletCapability: () => ({
        getChainTip: async () => 3_000_000,
        syncGroup,
      }),
    });

    await service.enablePrivacyMode({
      networkId: 'zec--0',
      accountId,
      birthdayHeight: 2_000_000,
    });

    expect(syncGroup).not.toHaveBeenCalled();
    expect(zcashPreparePrivacyModeAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, fromHeight: 2_000_000 }),
    );
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable,
    ).toHaveBeenCalledWith({ accountId, maxEnabledAccounts: 5 });
    expect(
      zcashPreparePrivacyModeAccount.mock.invocationCallOrder[0],
    ).toBeLessThan(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable.mock
        .invocationCallOrder[0],
    );
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
  });
});

// The settings page turns an account off before deleting its data. Deleting
// on its own refuses any state but a settled "off".
describe('Zcash Privacy Mode delete after turning the account off', () => {
  it.each([
    ['enabled', { intent: 'on', birthdayHeight: 2_000_000 }],
    [
      'interrupted while enabling',
      {
        intent: 'on',
        birthdayHeight: 2_000_000,
        operation: { type: 'enable', requestedAt: 1 },
      },
    ],
  ] as const)('deletes an account that was %s', async (_, initial) => {
    const { backgroundApi, service } = createService();
    let state: Record<string, unknown> = { ...initial };
    backgroundApi.simpleDb.zcash.getPrivacyModeState.mockImplementation(
      async () => state,
    );
    backgroundApi.simpleDb.zcash.beginPrivacyModeDisable.mockImplementation(
      async () => {
        state = { ...state, operation: { type: 'disable', requestedAt: 2 } };
      },
    );
    backgroundApi.simpleDb.zcash.completePrivacyModeDisable.mockImplementation(
      async () => {
        const { operation: _operation, ...rest } = state;
        state = { ...rest, intent: 'off' };
      },
    );
    const deleteLocalPrivacyData = jest.fn(async () => {
      if (state.intent !== 'off' || state.operation !== undefined) {
        throw new OneKeyLocalError('Privacy Mode changed while deleting');
      }
    });
    mockGetChainOnlyVault.mockResolvedValue({
      deleteLocalPrivacyData,
      getLocalWalletCapability: () => ({
        getSyncProgress: async () => undefined,
      }),
    });

    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });
    await service.deleteLocalPrivacyData({ networkId: 'zec--0', accountId });

    expect(state.intent).toBe('off');
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeDisable,
    ).toHaveBeenCalledTimes(1);
    expect(deleteLocalPrivacyData).toHaveBeenCalledWith({ accountId });
  });
});

describe('Zcash Privacy Mode enable failure cleanup', () => {
  it('clears only the failed enable operation when viewing setup rejects', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.zcash.getAccountMeta
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ ufvk: 'synthetic-ufvk', birthdayHeight: 2_000_000 });
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup: jest
        .fn()
        .mockRejectedValue(new Error('setup failed')),
    });

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 2_000_000,
      }),
    ).rejects.toThrow('setup failed');

    expect(
      backgroundApi.simpleDb.zcash.cancelPendingPrivacyModeEnables,
    ).toHaveBeenCalledWith({ accountId });
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('resumes a paused account without asking for the password again', async () => {
    const { backgroundApi, service } = createService();
    // A pause keeps birthday, resume cursor and viewing metadata, so there is
    // nothing to derive and no seed to unlock.
    backgroundApi.simpleDb.zcash.getPrivacyModeState.mockResolvedValue({
      intent: 'off',
      birthdayHeight: 2_000_000,
      resumeFromHeight: 2_500_000,
    });
    const zcashRetryLocalWalletSetup = jest.fn();
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup,
      zcashPreparePrivacyModeAccount: jest.fn(
        async ({ onPrepared }: { onPrepared: () => Promise<void> }) =>
          onPrepared(),
      ),
    });

    await service.enablePrivacyMode({ networkId: 'zec--0', accountId });

    expect(
      backgroundApi.servicePassword.promptPasswordVerifyByAccount,
    ).not.toHaveBeenCalled();
    expect(zcashRetryLocalWalletSetup).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable,
    ).toHaveBeenCalledWith({ accountId, maxEnabledAccounts: 5 });
  });

  it('does not report a failed notification as a failed enable', async () => {
    const { backgroundApi, service } = createService();
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup: jest.fn(),
      zcashPreparePrivacyModeAccount: jest.fn(
        async ({ onPrepared }: { onPrepared: () => Promise<void> }) =>
          onPrepared(),
      ),
    });
    backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged.mockRejectedValue(
      new Error('atom write failed'),
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 2_000_000,
      }),
    ).resolves.toBeUndefined();

    // Completing the enable already cleared the pending operation the
    // rollback keys on.
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundApi.simpleDb.zcash.cancelPendingPrivacyModeEnables,
    ).not.toHaveBeenCalled();
  });
});

it.each([false, true])(
  'uses the newly selected month instead of an old birthday (metadata retained: %s)',
  async (retained) => {
    const { backgroundApi, service } = createService();
    const birthdayTimestamp = 1_700_000_000_000;
    backgroundApi.simpleDb.zcash.getPrivacyModeState.mockResolvedValue({
      intent: 'off',
      birthdayHeight: 2_000_000,
      resumeFromHeight: 2_500_000,
    });
    if (!retained) {
      backgroundApi.simpleDb.zcash.getAccountMeta
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue({
          ufvk: 'synthetic-ufvk',
          birthdayHeight: 1_800_000,
          birthdayTimestamp,
        });
    }
    const prepare = jest.fn(
      async ({ onPrepared }: { onPrepared: () => Promise<void> }) =>
        onPrepared(),
    );
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup: jest.fn(),
      zcashPreparePrivacyModeAccount: prepare,
    });
    await service.enablePrivacyMode({
      networkId: 'zec--0',
      accountId,
      birthdayTimestamp,
    });
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).toHaveBeenCalledWith({
      accountId,
      birthdayHeight: undefined,
      birthdayTimestamp,
      resetResumeFromHeight: true,
    });
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        fromHeight: retained ? 2_000_000 : 1_800_000,
        birthday: retained
          ? { type: 'timestamp', timestamp: birthdayTimestamp }
          : undefined,
      }),
    );
  },
);

it('reconciles persisted birthday intent after interruption before runtime repair', async () => {
  const { backgroundApi, service } = createService();
  const birthdayTimestamp = 1_700_000_000_000;
  backgroundApi.simpleDb.zcash.getPrivacyModeState.mockResolvedValue({
    intent: 'off',
    birthdayTimestamp,
  });
  const prepare = jest.fn(
    async ({ onPrepared }: { onPrepared: () => Promise<void> }) => onPrepared(),
  );
  mockGetVault.mockResolvedValue({ zcashPreparePrivacyModeAccount: prepare });
  await service.enablePrivacyMode({ networkId: 'zec--0', accountId });
  expect(prepare).toHaveBeenCalledWith(
    expect.objectContaining({
      birthday: { type: 'timestamp', timestamp: birthdayTimestamp },
    }),
  );
  expect(
    backgroundApi.servicePassword.promptPasswordVerifyByAccount,
  ).not.toHaveBeenCalled();
});
