import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createUntrackedMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import { XMR_BIRTHDAY_PENDING_SOURCE } from './birthday';
import { buildXmrLocalWalletCapability } from './localWallet';

import type Vault from './Vault';

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime', () => ({
  hasXmrRuntimeApiLoader: () => true,
  readXmrRuntimeError: jest.requireActual(
    '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime',
  ).readXmrRuntimeError,
}));

const mockRuntime = jest.fn(async () => {
  throw new OneKeyLocalError('synthetic offline runtime');
});
let mockBusy = false;
jest.mock('./runtime', () => ({
  getXmrRuntime: () => mockRuntime(),
  getXmrLocalRuntime: () => mockRuntime(),
  getXmrIdentityId: async () => '3',
  getXmrRuntimeUuid: async () => 'a'.repeat(32),
  getXmrLastKnownChainTip: async () => undefined,
  forgetXmrStaleFirst: jest.fn(),
  readXmrStaleFirst: async <T>(params: {
    read: () => Promise<T>;
    fallback: T;
  }) => (mockBusy ? params.fallback : params.read()),
}));

const accountId = 'hd-1--xmr';
const networkId = 'xmr--0';
const vkFp = 'a'.repeat(32);
const timestamp = Date.UTC(2024, 0, 1);

function build() {
  const state = new SimpleDbEntityPrivacyChainState();
  const storage = createUntrackedMemoryStorage(null);
  (state as { appStorage: unknown }).appStorage = {
    getItem: storage.getItem,
    setItem: storage.setItem,
  };
  const notify = jest.fn(async () => undefined);
  const vault = {
    networkId,
    getXmrViewingKeys: async () => ({ vkFp }),
    backgroundApi: {
      simpleDb: { privacyChainState: state },
      servicePrivacyChain: {
        onLocalWalletAccountsChanged: notify,
        ensureLocalWalletViewingKey: async () => 'synthetic-key',
      },
    },
  } as unknown as Vault;
  return { state, notify, capability: buildXmrLocalWalletCapability(vault) };
}

beforeEach(() => {
  mockRuntime.mockClear();
  mockBusy = false;
});

describe('xmr legacy enable and resume admission', () => {
  it('resumes a saved date without opening the offline Runtime', async () => {
    const { state, capability } = build();
    await state.beginXmrEnable({
      networkId,
      accountId,
      birthdayHeight: 1,
      birthdaySource: XMR_BIRTHDAY_PENDING_SOURCE,
      birthdayTimestamp: timestamp,
    });
    await state.completeXmrEnable({ accountId, vkFp });
    await state.beginXmrDisable({ accountId, resumeFromHeight: 1 });
    await state.completeXmrDisable({ accountId });

    await capability.enableAccount({ accountId });

    expect(await state.getXmrAccountState({ accountId })).toMatchObject({
      intent: 'on',
      birthdayHeight: 1,
      birthdayTimestamp: timestamp,
      birthdaySource: XMR_BIRTHDAY_PENDING_SOURCE,
    });
    expect(mockRuntime).not.toHaveBeenCalled();
  });

  it('migrates an interrupted enable journal without losing its date', async () => {
    const { state, capability } = build();
    await state.beginXmrEnable({
      networkId,
      accountId,
      birthdayHeight: 1,
      birthdaySource: XMR_BIRTHDAY_PENDING_SOURCE,
      birthdayTimestamp: timestamp,
    });

    await capability.retryAccountSetup({ accountId });

    const saved = await state.getXmrAccountState({ accountId });
    expect(saved).toMatchObject({
      intent: 'on',
      birthdayTimestamp: timestamp,
      birthdaySource: XMR_BIRTHDAY_PENDING_SOURCE,
    });
    expect(saved.operation).toBeUndefined();
    expect(mockRuntime).not.toHaveBeenCalled();
  });

  it('preserves the original resolved start when resuming', async () => {
    const { state, capability } = build();
    await state.beginXmrEnable({
      networkId,
      accountId,
      birthdayHeight: 3_000_000,
    });
    await state.completeXmrEnable({ accountId, vkFp });
    await state.beginXmrDisable({ accountId, resumeFromHeight: 3_700_000 });
    await state.completeXmrDisable({ accountId });

    await capability.enableAccount({ accountId });

    expect(await state.getXmrAccountState({ accountId })).toMatchObject({
      intent: 'on',
      birthdayHeight: 3_000_000,
    });
    expect(mockRuntime).not.toHaveBeenCalled();
  });

  it('saves a changed target without waiting for node or scan preparation', async () => {
    const { state, capability, notify } = build();
    await state.saveXmrEnabledAccount({
      networkId,
      accountId,
      vkFp,
      birthdayHeight: 3_000_000,
    });
    await capability.enableAccount({ accountId, birthdayHeight: 3_700_000 });
    expect(await state.getXmrAccountState({ accountId })).toMatchObject({
      birthdayHeight: 3_700_000,
    });
    expect(mockRuntime).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('keeps successful admission when scheduler notification fails', async () => {
    const { state, capability, notify } = build();
    notify.mockRejectedValueOnce(
      new OneKeyLocalError('synthetic bridge failure'),
    );
    await expect(
      capability.enableAccount({ accountId, birthdayTimestamp: timestamp }),
    ).resolves.toBeUndefined();
    expect((await state.getXmrAccountState({ accountId })).intent).toBe('on');
  });

  it('keeps the resume start when a busy Runtime has no fresh progress', async () => {
    const { state, capability } = build();
    await state.saveXmrEnabledAccount({
      networkId,
      accountId,
      vkFp,
      birthdayHeight: 3_000_000,
    });
    mockBusy = true;
    await capability.disableAccount({ accountId });
    expect(await state.getXmrAccountState({ accountId })).toMatchObject({
      intent: 'off',
      resumeFromHeight: 3_000_000,
    });
  });
});
