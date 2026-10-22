/* cspell:ignore Ufvks */
import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getEndpointHealth,
  getRuntime,
  noteNetworkOutcome,
  recordEndpointHealth,
  withWallet,
  withWalletLease,
} from './carrier';

import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('./carrier', () => ({
  ...jest.requireActual<typeof import('./carrier')>('./carrier'),
  getRuntime: jest.fn(),
  withWallet: jest.fn(),
}));
jest.mock('./runtimeSelfTest', () => ({ runRuntimeSelfTest: jest.fn() }));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://public-a.example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-seed',
  hdIndex: 0,
  birthdayHeight: 1,
};

function networkError() {
  return Object.assign(new OneKeyLocalError('offline'), {
    code: 'NETWORK_ERROR',
    params: {},
  });
}

function mockWallet(rt: Record<string, unknown>) {
  jest
    .mocked(withWallet)
    .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
      ReturnType<typeof withWallet>
    >);
}

describe('Zcash endpoint outcomes through the leased API', () => {
  beforeEach(() => {
    recordEndpointHealth({ ok: true, latencyMs: null });
  });

  it('stays on one endpoint through repeated network and runtime failures', () => {
    const { url } = getEndpointHealth() ?? {};
    const malformedBlock = Object.assign(new OneKeyLocalError('bad block'), {
      code: 'INVALID_DATA',
      params: { operation: 'syncStep' },
    });
    for (const failure of [networkError(), malformedBlock]) {
      for (let retry = 0; retry < 6; retry += 1) {
        noteNetworkOutcome(failure);
        expect(getEndpointHealth()).toMatchObject({ url, ok: false });
      }
    }
    noteNetworkOutcome(null);
    expect(getEndpointHealth()).toMatchObject({ url, ok: true });
  });

  it('carries the last latency forward for samples from the same endpoint', () => {
    recordEndpointHealth({ ok: true, latencyMs: 42 });
    recordEndpointHealth({ ok: true });
    expect(getEndpointHealth()?.latencyMs).toBe(42);
  });

  it('probes the tip on the requested endpoint without touching scan health', async () => {
    const api = await sdk.getZcashApi();
    noteNetworkOutcome(networkError());
    const before = getEndpointHealth();
    const rt = { chainTipAt: jest.fn().mockResolvedValue(123) };
    jest
      .mocked(getRuntime)
      .mockResolvedValue(
        rt as unknown as Awaited<ReturnType<typeof getRuntime>>,
      );

    await expect(
      api.getChainTip({
        network: 'main',
        lightwalletdUrl: 'https://private.example.invalid',
      }),
    ).resolves.toBe(123);
    expect(rt.chainTipAt).toHaveBeenCalledWith(
      'https://private.example.invalid',
    );
    expect(getEndpointHealth()).toEqual(before);
  });

  // A stored send is never resubmitted; it is mined or expires.
  it('does not resubmit a pending send when a new block arrives', async () => {
    const api = await sdk.getZcashApi();
    let tip = 10;
    const broadcastTransaction = jest.fn().mockRejectedValue(networkError());
    mockWallet({
      listAccounts: () => JSON.stringify(['uuid']),
      accountByUfvk: () => JSON.stringify({ uuid: 'uuid' }),
      accountBalance: () =>
        JSON.stringify({ chainTip: tip, fullyScannedHeight: tip }),
      accountSyncStatus: () => JSON.stringify({ isComplete: true }),
      syncPeek: () => JSON.stringify({ totalBlocks: 0 }),
      chainTip: jest.fn(async () => tip + 1),
      syncTip: jest.fn(async () => {
        tip += 1;
      }),
      syncPrepare: jest.fn(async () => {
        tip += 1;
      }),
      syncStep: jest.fn(async () =>
        JSON.stringify({ blocksScanned: 0, done: true }),
      ),
      pendingBroadcastTxids: () => JSON.stringify(['pending']),
      broadcastTransaction,
    });

    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).resolves.toMatchObject({ stateChanged: true });
    expect(broadcastTransaction).not.toHaveBeenCalled();
  });

  it('treats an unknown submit outcome as an endpoint failure, not success', async () => {
    const api = await sdk.getZcashApi();
    const pcztSubmit = jest.fn(async () =>
      JSON.stringify({
        txid: 'pending',
        broadcast: 'unknown',
        error: { code: 'NETWORK_ERROR', params: {}, detail: null },
      }),
    );
    mockWallet({ pcztSubmit });

    await expect(
      api.submitPczt(account, { pcztHex: '00' }),
    ).resolves.toMatchObject({ broadcastState: 'unknown' });
    expect(pcztSubmit).toHaveBeenCalledWith('uuid', Uint8Array.from([0]));
    expect(getEndpointHealth()?.ok).toBe(false);

    pcztSubmit.mockResolvedValueOnce(
      JSON.stringify({ txid: 'pending', broadcast: 'accepted' }),
    );
    await api.submitPczt(account, { pcztHex: '00' });
    expect(getEndpointHealth()?.ok).toBe(true);
  });
});

// A UI read never waits on a scan: when a scan owns the database, a read with
// a previous answer returns it instead of joining the lease.
describe('Zcash reads while a scan holds the lease', () => {
  function pool(total: string) {
    return {
      total,
      spendable: total,
      pendingChange: '0',
      pendingSpendable: '0',
      locked: '0',
      uneconomic: '0',
    };
  }
  function fakeRuntime(total: string) {
    return {
      accountBalance: jest.fn(() =>
        JSON.stringify({ orchard: pool(total), ironwood: pool('0') }),
      ),
      accountSyncStatus: jest.fn(() => JSON.stringify({ isComplete: true })),
    };
  }

  it('answers from the last balance instead of queueing behind a scan', async () => {
    const first = fakeRuntime('100');
    jest
      .mocked(withWallet)
      .mockResolvedValueOnce({ rt: first, accountUuid: 'u' } as never);
    const api = await sdk.getZcashApi();
    const before = await api.getBalance(account);
    expect(before.shielded).toBe('100');

    let releaseScan: () => void = () => {};
    const scan = withWalletLease(
      () =>
        new Promise<void>((resolve) => {
          releaseScan = resolve;
        }),
    );

    const during = fakeRuntime('250');
    jest
      .mocked(withWallet)
      .mockResolvedValueOnce({ rt: during, accountUuid: 'u' } as never);
    // Resolves now, from the last result, without touching the runtime.
    await expect(api.getBalance(account)).resolves.toBe(before);
    expect(during.accountBalance).not.toHaveBeenCalled();

    releaseScan();
    await scan;
    const after = await api.getBalance(account);
    expect(after.shielded).toBe('250');
  });
});

// While a scan holds the wallet, reads answer from the last result. A rescan
// makes the remembered progress wrong, so it must not be answered again.
describe('Zcash remembered reads after a rescan', () => {
  it('forgets the remembered progress once a rescan is queued', async () => {
    let scannedTo = 100;
    const rt = {
      listAccounts: () => JSON.stringify(['uuid']),
      accountBalance: () => JSON.stringify({ chainTip: 100 }),
      accountSyncStatus: () =>
        JSON.stringify({
          birthdayHeight: 1,
          chainTip: 100,
          scannedToHeight: scannedTo,
          remainingBlocks: 100 - scannedTo,
          isComplete: scannedTo >= 100,
        }),
      queueRescanFrom: () =>
        JSON.stringify({ queued: true, fromHeight: 1, toHeight: 100 }),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as never);
    const api = await sdk.getZcashApi();

    await expect(api.getSyncProgress(account)).resolves.toMatchObject({
      isBackfillComplete: true,
    });

    let releaseScan!: () => void;
    const scan = withWalletLease(
      () =>
        new Promise<void>((resolve) => {
          releaseScan = resolve;
        }),
    );
    // Mid-scan: the remembered answer, without waiting.
    await expect(api.getSyncProgress(account)).resolves.toMatchObject({
      isBackfillComplete: true,
    });

    const queued = api.queueRescanFrom(account, { fromHeight: 1 });
    releaseScan();
    await scan;
    await queued;
    scannedTo = 1;

    // Mid-scan again: the old "complete" must not come back; the read waits
    // for the scan and returns the rescan's real progress.
    let releaseNextScan: (() => void) | undefined;
    const nextScan = withWalletLease(
      () =>
        new Promise<void>((resolve) => {
          releaseNextScan = resolve;
        }),
    );
    const progress = api.getSyncProgress(account);
    // Assigned inside the lease callback, which the linter cannot see.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!releaseNextScan) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    releaseNextScan();
    await nextScan;
    await expect(progress).resolves.toMatchObject({
      isBackfillComplete: false,
    });
  });
});
