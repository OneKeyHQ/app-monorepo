/* cspell:ignore Ufvks */
import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getEndpointHealth,
  getRuntime,
  noteNetworkOutcome,
  pickLightwalletdUrl,
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
jest.mock('../constants', () => ({
  ...jest.requireActual<typeof import('../constants')>('../constants'),
  ZCASH_LIGHTWALLETD_MAINNET_FALLBACKS: [
    'https://public-a.example.invalid',
    'https://public-b.example.invalid',
  ],
}));

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

describe('Zcash endpoint outcomes through the leased API', () => {
  beforeEach(() => {
    pickLightwalletdUrl('https://reset.example.invalid');
    pickLightwalletdUrl(account.lightwalletdUrl);
  });

  it('keeps custom nodes pinned through network and repeated runtime failures', () => {
    const customUrl = 'https://private.example.invalid';
    const malformedBlock = Object.assign(new OneKeyLocalError('bad block'), {
      code: 'INVALID_DATA',
      params: { operation: 'syncStep' },
    });
    for (const failure of [networkError(), malformedBlock]) {
      for (let retry = 0; retry < 6; retry += 1) {
        expect(pickLightwalletdUrl(customUrl)).toBe(customUrl);
        noteNetworkOutcome(failure);
      }
    }
    expect(pickLightwalletdUrl(customUrl)).toBe(customUrl);
    expect(getEndpointHealth()?.url).toBe(customUrl);
  });

  it('reports the selected public endpoint and resets failover when configuration changes', () => {
    recordEndpointHealth({ ok: true, latencyMs: 42 });
    noteNetworkOutcome(networkError());
    noteNetworkOutcome(networkError());
    // The failure belongs to the endpoint that handled the request.
    expect(getEndpointHealth()?.url).toBe(account.lightwalletdUrl);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(
      'https://public-b.example.invalid',
    );
    recordEndpointHealth({ ok: true });
    expect(getEndpointHealth()).toMatchObject({
      url: 'https://public-b.example.invalid',
      latencyMs: null,
    });
    noteNetworkOutcome(networkError());
    const customUrl = 'https://private.example.invalid';
    expect(pickLightwalletdUrl(customUrl)).toBe(customUrl);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(
      account.lightwalletdUrl,
    );
    noteNetworkOutcome(networkError());
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(
      account.lightwalletdUrl,
    );
  });

  it('does not carry latency from the previous endpoint into a new sample', () => {
    pickLightwalletdUrl('https://previous.example.invalid');
    recordEndpointHealth({ ok: true, latencyMs: 42 });
    recordEndpointHealth({ ok: true });
    expect(getEndpointHealth()?.latencyMs).toBe(42);

    pickLightwalletdUrl(account.lightwalletdUrl);
    recordEndpointHealth({ ok: true });
    expect(getEndpointHealth()).toMatchObject({
      url: account.lightwalletdUrl,
      ok: true,
      latencyMs: null,
    });
  });

  it('does not let an unleased tip probe overwrite an in-flight scan endpoint', async () => {
    const api = await sdk.getZcashApi();
    pickLightwalletdUrl(account.lightwalletdUrl);
    noteNetworkOutcome(networkError());
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

    noteNetworkOutcome(networkError());
    expect(getEndpointHealth()?.url).toBe(account.lightwalletdUrl);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(
      'https://public-b.example.invalid',
    );
  });

  it('rotates after two failed scans separated by local preparation and successful tip reads', async () => {
    const api = await sdk.getZcashApi();
    const startUrl = pickLightwalletdUrl(account.lightwalletdUrl);
    const rt = {
      listAccounts: () => JSON.stringify(['uuid']),
      accountBalance: () =>
        JSON.stringify({ chainTip: 10, fullyScannedHeight: 9 }),
      syncPeek: () => JSON.stringify({ totalBlocks: 1 }),
      chainTip: jest.fn().mockResolvedValue(11),
      syncPrepare: jest.fn().mockResolvedValue(undefined),
      syncTip: jest.fn().mockResolvedValue(undefined),
      syncStep: jest.fn().mockRejectedValue(networkError()),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
        ReturnType<typeof withWallet>
      >);

    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await api.prepareWalletAccounts([account]);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(startUrl);
    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(rt.chainTip).toHaveBeenCalledTimes(2);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).not.toBe(startUrl);
  });

  it('counts caught rebroadcast errors once per pass, despite earlier network success', async () => {
    const api = await sdk.getZcashApi();
    const startUrl = pickLightwalletdUrl(account.lightwalletdUrl);
    let tip = 10;
    const rt = {
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
      broadcastRetryTxids: () => JSON.stringify(['pending']),
      broadcastTransaction: jest.fn().mockRejectedValue(networkError()),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
        ReturnType<typeof withWallet>
      >);

    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).resolves.toMatchObject({ stateChanged: true });
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(startUrl);
    await api.prepareWalletAccounts([account]);
    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).resolves.toMatchObject({ stateChanged: true });
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).not.toBe(startUrl);
  });

  it('counts caught broadcast transport errors instead of treating unknown outcomes as success', async () => {
    const api = await sdk.getZcashApi();
    const startUrl = pickLightwalletdUrl(account.lightwalletdUrl);
    const rt = {
      pcztSubmit: jest.fn(async () =>
        JSON.stringify({
          txid: 'pending',
          broadcast: 'unknown',
          error: { code: 'NETWORK_ERROR', params: {}, detail: null },
        }),
      ),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
        ReturnType<typeof withWallet>
      >);
    const submit = () =>
      api.submitPczt(account, { pcztHex: '00', reservationId: 'r' });
    await expect(submit()).resolves.toMatchObject({
      broadcastState: 'unknown',
    });
    await api.prepareWalletAccounts([account]);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(startUrl);
    await expect(submit()).resolves.toMatchObject({
      broadcastState: 'unknown',
    });
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).not.toBe(startUrl);
  });

  it('resets the failure streak after a successful scan operation', async () => {
    const api = await sdk.getZcashApi();
    const startUrl = pickLightwalletdUrl(account.lightwalletdUrl);
    let tip = 10;
    const rt = {
      listAccounts: () => JSON.stringify(['uuid']),
      accountByUfvk: () => JSON.stringify({ uuid: 'uuid' }),
      accountBalance: () =>
        JSON.stringify({ chainTip: tip, fullyScannedHeight: tip }),
      accountSyncStatus: () => JSON.stringify({ isComplete: true }),
      syncPeek: () => JSON.stringify({ totalBlocks: 1 }),
      chainTip: jest.fn(async () => tip + 1),
      syncTip: jest.fn(async () => {
        tip += 1;
      }),
      syncPrepare: jest.fn(async () => {
        tip += 1;
      }),
      syncStep: jest.fn().mockRejectedValue(networkError()),
      broadcastRetryTxids: () => JSON.stringify([]),
      pcztSubmit: jest.fn(async () =>
        JSON.stringify({ txid: 'pending', broadcast: 'accepted' }),
      ),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
        ReturnType<typeof withWallet>
      >);
    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    rt.syncStep.mockResolvedValue(
      JSON.stringify({ blocksScanned: 0, done: true }),
    );
    await api.syncWallet(account, { activeUfvks: [account.ufvk] });
    rt.syncStep.mockRejectedValue(networkError());
    await expect(
      api.syncWallet(account, { activeUfvks: [account.ufvk] }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(startUrl);
    await api.submitPczt(account, { pcztHex: '00', reservationId: 'r' });
  });
});

/**
 * The rule: a UI read never waits on a scan. When the fast path misses
 * because a scan owns the database, a read that has an answer from before
 * returns it instead of joining the lease -- which would wait out the whole
 * pass, seconds normally and minutes inside the spam wall.
 */
describe('Zcash reads while a scan holds the lease', () => {
  function pool(total: string) {
    return {
      total,
      spendable: total,
      pendingChange: '0',
      pendingSpendable: '0',
      locked: '0',
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
