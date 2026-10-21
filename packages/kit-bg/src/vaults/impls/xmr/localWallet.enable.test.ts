import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { buildXmrLocalWalletCapability } from './localWallet';

import type Vault from './Vault';

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime', () => ({
  hasXmrRuntimeApiLoader: () => true,
  readXmrRuntimeError: jest.requireActual(
    '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime',
  ).readXmrRuntimeError,
}));

const TIP = 3_768_162;
const runtime = {
  addAccount: jest.fn(
    async (
      _uuid: string,
      _spendPublicKeyHex: string,
      _viewPrivateKeyHex: string,
      _birthdayHeight: string,
    ) => JSON.stringify({ accountId: 3 }),
  ),
  listAccounts: async () =>
    JSON.stringify({ items: [{ accountId: 3, uuid: 'acc' }] }),
  registerSubaddress: jest.fn(async () => '{}'),
  updateChainTip: jest.fn(async () => '{}'),
  rewindTo: jest.fn(async () => '{}'),
  chainTip: async () => JSON.stringify({ height: TIP }),
};

let mockBusy = false;
const mockForgetStaleFirst = jest.fn<void, [string]>();
jest.mock('./runtime', () => ({
  forgetXmrStaleFirstAccount: (accountId: string) =>
    mockForgetStaleFirst(accountId),
  getXmrRuntime: async () => runtime,
  getXmrLocalRuntime: async () => runtime,
  getXmrIdentityId: async () => '3',
  getXmrChainTip: async () => TIP,
  getXmrLastKnownChainTip: async () => TIP,
  readXmrStaleFirst: async <T>(p: {
    read: () => Promise<T>;
    fallback: T;
  }): Promise<T> => (mockBusy ? p.fallback : p.read()),
}));

function build(stored: { birthdayHeight?: number } = {}) {
  const calls: string[] = [];
  const completed: { birthdayHeight?: number }[] = [];
  const notify = jest.fn(async () => undefined);
  const disabled: { resumeFromHeight?: number }[] = [];
  const vault = {
    networkId: 'xmr--0',
    getXmrViewingKeys: async () => ({
      primaryAddress: '4...',
      spendPublicKeyHex: 'aa',
      viewPrivateKeyHex: 'bb',
    }),
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          getAccountEpoch: async () => 'e1',
          beginXmrEnable: async () => calls.push('beginEnable'),
          completeXmrEnable: async (params: { birthdayHeight?: number }) => {
            calls.push('completeEnable');
            completed.push(params);
          },
          getXmrAccountState: async () => ({
            intent: 'on',
            operation: undefined,
            ...stored,
          }),
          beginXmrDisable: async (params: { resumeFromHeight?: number }) => {
            disabled.push(params);
          },
          completeXmrDisable: async () => undefined,
        },
      },
      servicePrivacyChain: { onLocalWalletAccountsChanged: notify },
    },
  } as unknown as Vault;
  return {
    capability: buildXmrLocalWalletCapability(vault),
    calls,
    completed,
    notify,
    disabled,
  };
}

beforeEach(() => {
  runtime.addAccount.mockClear();
  runtime.registerSubaddress.mockClear();
  runtime.updateChainTip.mockClear();
  runtime.rewindTo.mockClear();
});

describe('xmr enableAccount', () => {
  // The runtime queues birthday..tip only once it learns the tip.
  it('queues the first scan range right away', async () => {
    const { capability } = build();
    await capability.enableAccount({
      accountId: 'acc',
      birthdayTimestamp: Date.UTC(2024, 0, 1),
    });
    expect(runtime.updateChainTip).toHaveBeenCalledWith('3', String(TIP));
  });

  it('converts a chosen month into a height below the tip', async () => {
    const { capability } = build();
    await capability.enableAccount({
      accountId: 'acc',
      birthdayTimestamp: Date.UTC(2024, 0, 1),
    });
    const height = Number(runtime.addAccount.mock.calls[0][3]);
    expect(height).toBeLessThan(TIP);
    expect(height).toBeGreaterThan(0);
  });

  it('wakes the scheduler and the UI once the account is on', async () => {
    const { capability, calls, notify } = build();
    await capability.enableAccount({ accountId: 'acc' });
    expect(calls).toEqual(['beginEnable', 'completeEnable']);
    expect(notify).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountIds: ['acc'],
      backfillActive: true,
    });
  });

  // Resume passes no birthday, so the tip goes in; the runtime keeps the
  // existing identity's birthday, and that is what must be stored.
  it("stores the runtime's birthday when the identity already exists", async () => {
    runtime.addAccount.mockImplementationOnce(async () =>
      JSON.stringify({ accountId: 3, birthdayHeight: 3_000_000 }),
    );
    const { capability, completed } = build();
    await capability.enableAccount({ accountId: 'acc' });
    expect(runtime.addAccount.mock.calls[0][3]).toBe(String(TIP));
    expect(completed).toEqual([
      { accountId: 'acc', birthdayHeight: 3_000_000 },
    ]);
  });

  // If the scanned data is gone, resuming from the tip would hide old funds.
  it('resumes from the original start, not the tip', async () => {
    const { capability } = build({ birthdayHeight: 3_000_000 });
    await capability.enableAccount({ accountId: 'acc' });
    expect(runtime.addAccount.mock.calls[0][3]).toBe('3000000');
    expect(runtime.rewindTo).not.toHaveBeenCalled();
  });

  // Blocks after the old start were scanned without the older outputs, so
  // an earlier start means rescanning from it.
  it('rescans from a start chosen earlier than the existing one', async () => {
    runtime.addAccount.mockImplementationOnce(async () =>
      JSON.stringify({ accountId: 3, birthdayHeight: 3_500_000 }),
    );
    const { capability, completed } = build({ birthdayHeight: 3_500_000 });
    await capability.enableAccount({
      accountId: 'acc',
      birthdayHeight: 3_000_000,
    });
    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '2999999', String(TIP));
    expect(completed).toEqual([
      { accountId: 'acc', birthdayHeight: 3_000_000 },
    ]);
  });

  it('does not report a failed notification as a failed enable', async () => {
    const { capability, notify } = build();
    notify.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('bridge down');
    });
    await expect(
      capability.enableAccount({ accountId: 'acc' }),
    ).resolves.toBeUndefined();
  });
});

describe('xmr disableAccount', () => {
  afterEach(() => {
    mockBusy = false;
  });

  // Mid-step the progress read has no height; the account must still read as
  // paused afterwards, not as never enabled.
  it('marks the account paused even while a step holds the runtime', async () => {
    mockBusy = true;
    const { capability, disabled } = build({ birthdayHeight: 3_000_000 });
    await capability.disableAccount({ accountId: 'acc' });
    expect(disabled).toEqual([
      { accountId: 'acc', resumeFromHeight: 3_000_000 },
    ]);
  });
});
