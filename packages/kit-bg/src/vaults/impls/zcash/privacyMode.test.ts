import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

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
const syntheticVkFp = getViewingKeyFingerprint({
  networkId: 'zec--0',
  viewingKey: 'synthetic-ufvk',
});

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
      privacyChainState: {
        getZcashPrivacyModeState: jest
          .fn()
          .mockResolvedValue({ intent: 'off' }),
        isZcashPrivacyModeEnabled: jest
          .fn()
          .mockResolvedValue(privacyModeEnabled),
        beginZcashPrivacyModeEnable: jest.fn(),
        completeZcashPrivacyModeEnable: jest.fn(),
        cancelZcashPendingEnables: jest.fn(),
        beginZcashPrivacyModeDisable: jest.fn(),
        completeZcashPrivacyModeDisable: jest.fn(),
        getZcashAccountMeta: jest.fn().mockResolvedValue({
          vkFp: syntheticVkFp,
          birthdayHeight: 2_000_000,
        }),
      },
      privacyChainKeys: {
        getKey: jest.fn().mockResolvedValue({
          networkId: 'zec--0',
          vkFp: syntheticVkFp,
          sealed: { format: 'plain', value: 'synthetic-ufvk' },
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
      backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeEnable,
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
      backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeEnable,
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
      backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeEnable,
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
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
      {
        intent: 'on',
        birthdayHeight: 2_000_000,
      },
    );
    const mutex = getZcashLifecycleMutex(syntheticVkFp);
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
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable,
    ).toHaveBeenCalledTimes(2);
    expect(mutex.isLocked()).toBe(false);
  });

  it('prepares the enable rescan without starting a scan before admission', async () => {
    const { backgroundApi, service } = createService();
    // First enable: no viewing metadata yet, so derivation must run. The
    // second read is the post-derivation check inside the service.
    backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ vkFp: syntheticVkFp, birthdayHeight: 2_000_000 });
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
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable,
    ).toHaveBeenCalledWith({ accountId, maxEnabledAccounts: 5 });
    expect(
      zcashPreparePrivacyModeAccount.mock.invocationCallOrder[0],
    ).toBeLessThan(
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable
        .mock.invocationCallOrder[0],
    );
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
  });
});

// The settings page turns an account off before deleting its data. Deleting
// on its own refuses any state but a settled "off".
// Deleting local data (ServicePrivacyChain) turns the account off first and
// refuses unless it is then off with no operation open.
describe('Zcash Privacy Mode turning off before a delete', () => {
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
  ] as const)('leaves an account that was %s off', async (_, initial) => {
    const { backgroundApi, service } = createService();
    let state: Record<string, unknown> = { ...initial };
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockImplementation(
      async () => state,
    );
    backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeDisable.mockImplementation(
      async () => {
        state = { ...state, operation: { type: 'disable', requestedAt: 2 } };
      },
    );
    backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable.mockImplementation(
      async () => {
        const { operation: _operation, ...rest } = state;
        state = { ...rest, intent: 'off' };
      },
    );
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        getSyncProgress: async () => undefined,
      }),
    });

    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });

    expect(state.intent).toBe('off');
    expect(state.operation).toBeUndefined();
    expect(
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable,
    ).toHaveBeenCalledTimes(1);
  });
});

describe('Zcash Privacy Mode enable failure cleanup', () => {
  it('clears only the failed enable operation when viewing setup rejects', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ vkFp: syntheticVkFp, birthdayHeight: 2_000_000 });
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
      backgroundApi.simpleDb.privacyChainState.cancelZcashPendingEnables,
    ).toHaveBeenCalledWith({ networkId: 'zec--0', accountId });
    expect(
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('resumes a paused account without asking for the password again', async () => {
    const { backgroundApi, service } = createService();
    // A pause keeps birthday, resume cursor and viewing metadata, so there is
    // nothing to derive and no seed to unlock.
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
      {
        intent: 'off',
        birthdayHeight: 2_000_000,
        resumeFromHeight: 2_500_000,
      },
    );
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
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable,
    ).toHaveBeenCalledWith({ accountId, maxEnabledAccounts: 5 });
  });

  it('derives the key again when a paused account lost it', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
      {
        intent: 'off',
        birthdayHeight: 2_000_000,
        resumeFromHeight: 2_500_000,
      },
    );
    backgroundApi.simpleDb.privacyChainKeys.getKey.mockResolvedValue(undefined);
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
    ).toHaveBeenCalledTimes(1);
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledWith({
      password: 'test-password',
    });
  });

  it('repairs an enabled account whose key is gone instead of returning early', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
      {
        intent: 'on',
        birthdayHeight: 2_000_000,
      },
    );
    backgroundApi.simpleDb.privacyChainKeys.getKey.mockResolvedValue(undefined);
    const zcashRetryLocalWalletSetup = jest.fn();
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup,
      zcashPreparePrivacyModeAccount: jest.fn(
        async ({ onPrepared }: { onPrepared: () => Promise<void> }) =>
          onPrepared(),
      ),
    });

    await service.enablePrivacyMode({ networkId: 'zec--0', accountId });

    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
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
      backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable,
    ).toHaveBeenCalledTimes(1);
    expect(
      backgroundApi.simpleDb.privacyChainState.cancelZcashPendingEnables,
    ).not.toHaveBeenCalled();
  });
});

it.each([false, true])(
  'uses the newly selected month instead of an old birthday (metadata retained: %s)',
  async (retained) => {
    const { backgroundApi, service } = createService();
    const birthdayTimestamp = 1_700_000_000_000;
    backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
      {
        intent: 'off',
        birthdayHeight: 2_000_000,
        resumeFromHeight: 2_500_000,
      },
    );
    if (!retained) {
      backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue({
          vkFp: syntheticVkFp,
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
      backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeEnable,
    ).toHaveBeenCalledWith({
      networkId: 'zec--0',
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
  backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState.mockResolvedValue(
    {
      intent: 'off',
      birthdayTimestamp,
    },
  );
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
