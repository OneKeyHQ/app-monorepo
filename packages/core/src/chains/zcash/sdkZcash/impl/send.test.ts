import { ZCASH_CURRENT_SHIELDED_POOL } from '../constants';

import {
  broadcastPczt,
  createPczt,
  finalizePczt,
  quotePczt,
  quoteShieldFunds,
  releasePczt,
  shieldFunds,
} from './send';

import type { IZcashWalletAccount } from '../types/sdk';

const mockPcztQuote = jest.fn();
const mockPcztCreate = jest.fn();
const mockPcztShield = jest.fn();
const mockPcztShieldQuote = jest.fn();
const mockPcztSend = jest.fn();
const mockBroadcastTransaction = jest.fn();
const mockReleaseReservation = jest.fn();
const mockRuntimeCapabilities = jest.fn();
const mockKeysCapabilities = jest.fn();

const runtime = {
  pcztQuote: mockPcztQuote,
  pcztCreate: mockPcztCreate,
  pcztShield: mockPcztShield,
  pcztShieldQuote: mockPcztShieldQuote,
  pcztSend: mockPcztSend,
  broadcastTransaction: mockBroadcastTransaction,
  releaseReservation: mockReleaseReservation,
  capabilities: mockRuntimeCapabilities,
};

jest.mock('./carrier', () => ({
  getRuntime: jest.fn(async () => runtime),
  getKeys: jest.fn(async () => ({
    keysCapabilities: mockKeysCapabilities,
  })),
  withWallet: jest.fn(async () => ({
    rt: runtime,
    accountUuid: 'account-uuid',
  })),
}));

const account: IZcashWalletAccount = {
  network: 'main',
  lightwalletdUrl: 'https://example.invalid',
  ufvk: 'test-ufvk',
  seedFingerprintHex: 'test-seed',
  hdIndex: 0,
};

describe('Zcash PCZT send policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRuntimeCapabilities.mockReturnValue(
      JSON.stringify({
        prove: { orchard: true, ironwood: true },
        notes: {},
      }),
    );
    mockKeysCapabilities.mockReturnValue(
      JSON.stringify({
        sign: { orchard: true, ironwood: true, transparent: true },
      }),
    );
  });

  it('pins an Orchard quote to Orchard note selection', async () => {
    mockPcztQuote.mockReturnValue(
      JSON.stringify({
        feeZat: 10_000,
        sourceTransparentZat: 0,
        sourceShieldedZat: 90_000,
        linksTransparentToShielded: false,
        shieldedOnlyFeeZat: 10_000,
      }),
    );

    await expect(
      quotePczt(account, {
        toAddress: 't1-recipient',
        valueZat: '90000',
        spendSource: 'orchard',
      }),
    ).resolves.toMatchObject({
      feeZat: '10000',
      sourceShieldedZat: '90000',
    });

    expect(mockPcztQuote).toHaveBeenCalledWith(
      'account-uuid',
      't1-recipient',
      90_000n,
      null,
      3,
      10,
      'ironwood',
      false,
      false,
      'orchard',
    );
  });

  it('pins PCZT creation to the selected Ironwood pool', async () => {
    mockPcztCreate.mockReturnValue(
      JSON.stringify({
        pcztHex: '0102',
        reservationId: 'reservation-id',
        feeZat: 10_000,
      }),
    );

    await expect(
      createPczt(account, {
        toAddress: 't1-recipient',
        valueZat: '90000',
        spendSource: 'ironwood',
        reservationId: 'host-reservation-id',
      }),
    ).resolves.toEqual({
      pcztHex: '0102',
      reservationId: 'reservation-id',
      feeZat: '10000',
    });

    expect(mockPcztCreate).toHaveBeenCalledWith(
      'account-uuid',
      't1-recipient',
      90_000n,
      null,
      3,
      10,
      'ironwood',
      false,
      10,
      'host-reservation-id',
      false,
      false,
      'ironwood',
    );
  });

  it('always pins exactly one shielded pool (no cross-pool sends)', async () => {
    mockPcztQuote.mockReturnValue(
      JSON.stringify({
        feeZat: 10_000,
        sourceTransparentZat: 0,
        sourceShieldedZat: 90_000,
        linksTransparentToShielded: false,
        shieldedOnlyFeeZat: 10_000,
      }),
    );

    await quotePczt(account, {
      toAddress: 'u1-recipient',
      valueZat: '90000',
      spendSource: ZCASH_CURRENT_SHIELDED_POOL,
    });

    expect(mockPcztQuote).toHaveBeenLastCalledWith(
      'account-uuid',
      'u1-recipient',
      90_000n,
      null,
      3,
      10,
      'ironwood',
      false,
      false,
      ZCASH_CURRENT_SHIELDED_POOL,
    );
  });

  it('uses the same transparent-first policy for quote and creation', async () => {
    mockPcztQuote.mockReturnValue(
      JSON.stringify({
        feeZat: 15_000,
        sourceTransparentZat: 60_000,
        sourceShieldedZat: 45_000,
        linksTransparentToShielded: true,
        shieldedOnlyFeeZat: 10_000,
      }),
    );
    mockPcztCreate.mockReturnValue(
      JSON.stringify({
        pcztHex: '0102',
        reservationId: 'reservation-id',
        feeZat: 15_000,
      }),
    );

    await quotePczt(account, {
      toAddress: 'u1-recipient',
      valueZat: '90000',
      spendSource: 'ironwood',
      spendTransparent: true,
    });
    await createPczt(account, {
      toAddress: 'u1-recipient',
      valueZat: '90000',
      spendSource: 'ironwood',
      spendTransparent: true,
    });

    expect(mockPcztQuote.mock.calls[0][7]).toBe(true);
    expect(mockPcztCreate.mock.calls[0][10]).toBe(true);
  });

  it('rejects transparent-first creation before locking when signing is unavailable', async () => {
    mockKeysCapabilities.mockReturnValue(
      JSON.stringify({
        sign: { orchard: true, ironwood: true, transparent: false },
      }),
    );

    await expect(
      createPczt(account, {
        toAddress: 'u1-recipient',
        valueZat: '90000',
        spendTransparent: true,
        spendSource: ZCASH_CURRENT_SHIELDED_POOL,
      }),
    ).rejects.toMatchObject({
      code: 'UNIMPLEMENTED',
      params: { missing: ['transparent'] },
    });
    expect(mockPcztCreate).not.toHaveBeenCalled();
  });

  it('returns the fee of the exact shielding proposal', async () => {
    mockPcztShield.mockReturnValue(
      JSON.stringify({
        pcztHex: '0304',
        reservationId: 'shield-reservation-id',
        feeZat: 20_000,
      }),
    );

    await expect(
      shieldFunds(account, { reservationId: 'host-shield-reservation-id' }),
    ).resolves.toEqual({
      pcztHex: '0304',
      reservationId: 'shield-reservation-id',
      feeZat: '20000',
    });
    expect(mockPcztShield).toHaveBeenCalledWith(
      'account-uuid',
      10_000n,
      3,
      10,
      'ironwood',
      false,
      10,
      'host-shield-reservation-id',
      false,
    );
  });

  it('quotes shielding without creating or locking a PCZT', async () => {
    mockPcztShieldQuote.mockReturnValue(JSON.stringify({ feeZat: 20_000 }));

    await expect(quoteShieldFunds(account)).resolves.toEqual({
      feeZat: '20000',
    });
    expect(mockPcztShieldQuote).toHaveBeenCalledWith(
      'account-uuid',
      10_000n,
      3,
      10,
      'ironwood',
      false,
      false,
    );
    expect(mockPcztShield).not.toHaveBeenCalled();
  });

  it('finalizes locally before broadcasting and can release reservations', async () => {
    mockPcztSend.mockReturnValue('txid');
    mockBroadcastTransaction.mockResolvedValue(undefined);

    const finalized = await finalizePczt(account, {
      pcztHex: '0102',
      reservationId: 'reservation-id',
    });
    await expect(broadcastPczt(account, finalized)).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'accepted',
    });

    expect(mockPcztSend).toHaveBeenCalledWith(
      'account-uuid',
      Uint8Array.from([1, 2]),
      'reservation-id',
    );
    expect(mockPcztSend.mock.invocationCallOrder[0]).toBeLessThan(
      mockBroadcastTransaction.mock.invocationCallOrder[0],
    );
    expect(mockBroadcastTransaction).toHaveBeenCalledWith('txid');

    await releasePczt(account, { reservationId: 'reservation-id' });
    expect(mockReleaseReservation).toHaveBeenCalledWith('reservation-id');
  });

  it('returns the persisted txid as pending when broadcast outcome is unknown', async () => {
    mockPcztSend.mockReturnValue('txid');
    mockBroadcastTransaction.mockRejectedValue(
      Object.assign(new Error('NETWORK_ERROR'), {
        code: 'NETWORK_ERROR',
        params: { operation: 'sendTransaction', timeoutMs: 30_000 },
      }),
    );

    await expect(broadcastPczt(account, { txid: 'txid' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'unknown',
      broadcastError: {
        code: 'NETWORK_ERROR',
        params: { operation: 'sendTransaction', timeoutMs: 30_000 },
        detail: undefined,
      },
    });
  });

  it('returns a definite rejection with the already-persisted txid', async () => {
    mockPcztSend.mockReturnValue('txid');
    mockBroadcastTransaction.mockRejectedValue(
      Object.assign(new Error('BROADCAST_REJECTED'), {
        code: 'BROADCAST_REJECTED',
        params: { errorCode: -26 },
        detail: 'bad-txns-inputs-missingorspent',
      }),
    );

    await expect(broadcastPczt(account, { txid: 'txid' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'rejected',
      broadcastError: {
        code: 'BROADCAST_REJECTED',
        params: { errorCode: -26 },
        detail: 'bad-txns-inputs-missingorspent',
      },
    });
  });

  it('keeps an unstructured bridge failure pending after txid is known', async () => {
    mockBroadcastTransaction.mockRejectedValue(
      new Error('bridge disconnected'),
    );

    await expect(broadcastPczt(account, { txid: 'txid' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'unknown',
      broadcastError: {
        code: 'BROADCAST_OUTCOME_UNKNOWN',
        params: {},
        detail: 'bridge disconnected',
      },
    });
  });
});
