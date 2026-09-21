/* cspell:ignore Ufvks */
import sdk from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  getEndpointHealth,
  pickLightwalletdUrl,
  recordEndpointHealth,
  withWallet,
} from './carrier';

import type { IZcashWalletAccount } from '../types/sdk';

jest.mock('./carrier', () => ({
  ...jest.requireActual<typeof import('./carrier')>('./carrier'),
  withWallet: jest.fn(),
}));
jest.mock('./storageBenchmarkEntry', () => ({
  runStorageBenchmark: jest.fn(),
}));
jest.mock('./runtimeSelfTest', () => ({ runRuntimeSelfTest: jest.fn() }));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
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
      broadcastTransaction: jest.fn().mockRejectedValue(networkError()),
    };
    jest
      .mocked(withWallet)
      .mockResolvedValue({ rt, accountUuid: 'uuid' } as unknown as Awaited<
        ReturnType<typeof withWallet>
      >);
    await expect(
      api.broadcastPczt(account, { txid: 'pending' }),
    ).resolves.toMatchObject({ broadcastState: 'unknown' });
    await api.prepareWalletAccounts([account]);
    expect(pickLightwalletdUrl(account.lightwalletdUrl)).toBe(startUrl);
    await expect(
      api.broadcastPczt(account, { txid: 'pending' }),
    ).resolves.toMatchObject({ broadcastState: 'unknown' });
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
      broadcastTransaction: jest.fn(),
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
    await api.broadcastPczt(account, { txid: 'pending' });
  });
});
