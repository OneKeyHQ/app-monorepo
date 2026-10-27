/* cspell:ignore Ufvks */
import * as runtime from 'onekey-zcash-runtime';

import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';

import { forgetOpenWallet } from './carrier';

import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('onekey-zcash-runtime', () => ({
  __esModule: true,
  default: async () => undefined,
  init: async () => undefined,
  storageRequiresWorkerRestart: () => false,
  openWallet: jest.fn(async () => undefined),
  setLightwalletdUrl: jest.fn(),
  accountByUfvk: jest.fn(),
  accountByName: jest.fn(),
  importAccountUfvk: jest.fn(),
  listAccounts: jest.fn(),
  accountBalance: jest.fn(),
  syncPeek: jest.fn(),
  syncPrepare: jest.fn(),
  syncTip: jest.fn(),
  syncStep: jest.fn(),
  chainTip: jest.fn(),
  removeAccount: jest.fn(),
  deleteWallet: jest.fn(),
}));

const pending: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'pending',
  seedFingerprintHex: 'synthetic-fingerprint',
  hdIndex: 0,
  birthdayHeight: 100,
  label: 'fp-pending',
};
const healthy = {
  ...pending,
  ufvk: 'healthy',
  hdIndex: 1,
  label: 'fp-healthy',
};
const later = { ...pending, ufvk: 'later', hdIndex: 2 };

function createRuntime(structured = false) {
  const registered = new Map<string, string>();
  const named = new Map<string, string>();
  const state = {
    allowPending: false,
    blocksToScan: 0,
    tip: 300,
    nodeTip: 300,
    scanned: 100,
  };
  const checkpointError = Object.assign(new Error('DATABASE_ERROR'), {
    payload: {
      code: 'DATABASE_ERROR',
      params: {
        operation: 'importAccount',
        ...(structured ? { reason: 'checkpointsDiverged' } : {}),
      },
      detail: structured
        ? undefined
        : 'retains checkpoints both above and below the requested height',
    },
  });
  jest
    .mocked(runtime.accountByUfvk)
    .mockImplementation((ufvk) =>
      JSON.stringify(
        registered.has(ufvk) ? { uuid: registered.get(ufvk) } : null,
      ),
    );
  jest
    .mocked(runtime.importAccountUfvk)
    .mockImplementation(async (name, ufvk) => {
      if (ufvk === pending.ufvk && !state.allowPending) throw checkpointError;
      registered.set(ufvk, ufvk);
      named.set(name, ufvk);
      return ufvk;
    });
  jest
    .mocked(runtime.accountByName)
    .mockImplementation((name) =>
      JSON.stringify(named.has(name) ? { uuid: named.get(name) } : null),
    );
  jest
    .mocked(runtime.listAccounts)
    .mockImplementation(() => JSON.stringify([...registered.values()]));
  jest.mocked(runtime.accountBalance).mockImplementation(() =>
    JSON.stringify({
      chainTip: state.tip,
      fullyScannedHeight: state.scanned,
    }),
  );
  jest
    .mocked(runtime.syncPeek)
    .mockImplementation(() =>
      JSON.stringify({ totalBlocks: state.blocksToScan }),
    );
  const updateTip = async () => {
    state.tip = state.nodeTip;
    return '{}';
  };
  jest.mocked(runtime.syncPrepare).mockImplementation(updateTip);
  jest.mocked(runtime.syncTip).mockImplementation(updateTip);
  jest.mocked(runtime.syncStep).mockImplementation(async () => {
    const blocksScanned = state.blocksToScan > 0 ? 1 : 0;
    state.blocksToScan -= blocksScanned;
    state.scanned += blocksScanned;
    return JSON.stringify({ blocksScanned, done: state.blocksToScan === 0 });
  });
  jest.mocked(runtime.deleteWallet).mockImplementation(async () => {
    registered.clear();
    return true;
  });
  return { state, checkpointError };
}

beforeEach(() => {
  forgetOpenWallet('main');
  forgetOpenWallet('test');
  jest.clearAllMocks();
});

it.each([false, true])(
  'continues the batch and retries once per actual scan advance (structured reason: %s)',
  async (structured) => {
    const { state } = createRuntime(structured);
    const api = await sdk.getZcashApi();
    const accounts = [pending, healthy, later];
    await expect(api.prepareWalletAccounts(accounts)).resolves.toEqual([
      healthy,
      later,
    ]);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(3);

    for (let tick = 0; tick < 5; tick += 1) {
      await api.prepareWalletAccounts(accounts);
      await api.syncWallet(healthy, {
        activeUfvks: [healthy.ufvk, later.ufvk],
        chainTip: state.nodeTip,
      });
    }
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(3);
    expect(runtime.chainTip).not.toHaveBeenCalled();
    expect(runtime.syncPrepare).not.toHaveBeenCalled();

    state.nodeTip += 1;
    await api.syncWallet(healthy, {
      activeUfvks: [healthy.ufvk],
      chainTip: state.nodeTip,
    });
    await api.prepareWalletAccounts(accounts);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(3);

    state.blocksToScan = 1;
    await api.syncWallet(healthy, {
      activeUfvks: [healthy.ufvk],
      chainTip: state.nodeTip,
    });
    await api.prepareWalletAccounts(accounts);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(4);
    await api.prepareWalletAccounts(accounts);
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(4);

    state.blocksToScan = 1;
    await api.syncWallet(healthy, {
      activeUfvks: [healthy.ufvk],
      chainTip: state.nodeTip,
    });
    state.allowPending = true;
    await expect(api.prepareWalletAccounts(accounts)).resolves.toEqual(
      accounts,
    );
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(5);
    expect(runtime.importAccountUfvk).toHaveBeenLastCalledWith(
      pending.label,
      pending.ufvk,
      pending.birthdayHeight,
      pending.seedFingerprintHex,
      0,
    );
  },
);

it('does not repeat a failed first import to run orphan cleanup', async () => {
  createRuntime();
  const api = await sdk.getZcashApi();
  await expect(
    api.prepareWalletAccounts([pending, healthy], {
      retainedLabels: [pending.label, healthy.label],
    }),
  ).resolves.toEqual([healthy]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);
});

it('keeps other import errors fatal to the batch', async () => {
  createRuntime();
  const error = Object.assign(new Error('DATABASE_ERROR'), {
    code: 'DATABASE_ERROR',
    params: { operation: 'importAccount' },
    detail: 'database is locked',
  });
  jest.mocked(runtime.importAccountUfvk).mockRejectedValueOnce(error);
  const api = await sdk.getZcashApi();
  await expect(api.prepareWalletAccounts([pending, healthy])).rejects.toBe(
    error,
  );
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(1);
});

it('allows a fresh import after an explicit database drop', async () => {
  const { state } = createRuntime();
  const api = await sdk.getZcashApi();
  await api.prepareWalletAccounts([pending]);
  await api.dropWalletDatabase('main');
  state.allowPending = true;
  await expect(api.prepareWalletAccounts([pending])).resolves.toEqual([
    pending,
  ]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);
});

it('retries each changed birthday without waiting for unrelated scan progress', async () => {
  const { state } = createRuntime();
  const api = await sdk.getZcashApi();
  await api.prepareWalletAccounts([pending, healthy]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);

  let expectedCalls = 2;
  for (const birthdayHeight of [200, 1, 150]) {
    // eslint-disable-next-line no-await-in-loop
    await api.prepareWalletAccounts([{ ...pending, birthdayHeight }, healthy]);
    expectedCalls += 1;
    expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(expectedCalls);
    expect(runtime.importAccountUfvk).toHaveBeenLastCalledWith(
      pending.label,
      pending.ufvk,
      birthdayHeight,
      pending.seedFingerprintHex,
      pending.hdIndex,
    );
  }

  state.allowPending = true;
  const latest = { ...pending, birthdayHeight: 50 };
  await expect(api.prepareWalletAccounts([latest, healthy])).resolves.toEqual([
    latest,
    healthy,
  ]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(expectedCalls + 1);
  expect(runtime.syncStep).not.toHaveBeenCalled();
});

it('clears a purged identity import failure while another account keeps the database', async () => {
  const { state } = createRuntime();
  const api = await sdk.getZcashApi();
  await api.prepareWalletAccounts([pending, healthy]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(2);

  await api.purgeWallet(pending);
  expect(runtime.removeAccount).not.toHaveBeenCalled();
  expect(runtime.deleteWallet).not.toHaveBeenCalled();
  state.allowPending = true;
  await expect(api.prepareWalletAccounts([pending, healthy])).resolves.toEqual([
    pending,
    healthy,
  ]);
  expect(runtime.importAccountUfvk).toHaveBeenCalledTimes(3);
});

it('preserves a trap from a lock-free account lookup instead of retrying it through the lease', async () => {
  createRuntime();
  const api = await sdk.getZcashApi();
  await api.prepareWalletAccounts([healthy]);
  const trap = new WebAssembly.RuntimeError('unreachable');
  jest.mocked(runtime.accountByUfvk).mockImplementationOnce(() => {
    throw trap;
  });
  jest.mocked(runtime.accountByUfvk).mockClear();
  await expect(
    Promise.resolve().then(() => api.getBalance(healthy)),
  ).rejects.toBe(trap);
  expect(runtime.accountByUfvk).toHaveBeenCalledTimes(1);
});

it('does not continue scanning after a wallet summary traps', async () => {
  createRuntime();
  const api = await sdk.getZcashApi();
  await api.prepareWalletAccounts([healthy]);
  const trap = new WebAssembly.RuntimeError('unreachable');
  jest.mocked(runtime.accountBalance).mockImplementationOnce(() => {
    throw trap;
  });

  await expect(
    api.syncWallet(healthy, { activeUfvks: [healthy.ufvk], chainTip: 300 }),
  ).rejects.toBe(trap);
  expect(runtime.syncStep).not.toHaveBeenCalled();
  expect(runtime.syncPrepare).not.toHaveBeenCalled();
});
