import { ZCASH_CURRENT_SHIELDED_POOL } from '../constants';

import { getKeys, withWallet } from './carrier';
import { createPczt, prewarmPczt, quotePczt, submitPczt } from './send';

import type { IZcashWalletAccount } from '../types/sdk';

const mockPcztQuote = jest.fn();
const mockPcztCreate = jest.fn();
const mockPcztSubmit = jest.fn();
const mockRuntimeCapabilities = jest.fn();
const mockKeysCapabilities = jest.fn();
const mockPrewarmPczt = jest.fn();

const runtime = {
  pcztQuote: mockPcztQuote,
  pcztCreate: mockPcztCreate,
  pcztSubmit: mockPcztSubmit,
  capabilities: mockRuntimeCapabilities,
  prewarmPczt: mockPrewarmPczt,
};

jest.mock('./carrier', () => ({
  noteNetworkOutcome: jest.fn(),
  getRuntime: jest.fn(async () => runtime),
  getRuntimeWasm: jest.fn(async () => runtime),
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
        sign: { orchard: true, ironwood: true },
      }),
    );
  });

  it('pins an Orchard quote to Orchard note selection', async () => {
    mockPcztQuote.mockReturnValue(JSON.stringify({ feeZat: 10_000, steps: 1 }));

    await expect(
      quotePczt(account, {
        toAddress: 't1-recipient',
        valueZat: '90000',
        spendSource: 'orchard',
      }),
    ).resolves.toEqual({ feeZat: '10000' });

    expect(mockPcztQuote).toHaveBeenCalledWith(
      'account-uuid',
      't1-recipient',
      90_000n,
      null,
      3,
      10,
      'ironwood',
      true, // padOrchardBundle
      false, // allowZeroConfShielding
      'orchard',
      null,
    );
  });

  it('prewarms public parameters without keys or storage', async () => {
    await prewarmPczt({ network: 'main', targetHeight: 3_500_000 });
    expect(mockPrewarmPczt).toHaveBeenCalledWith('main', 3_500_000);
    expect(getKeys).not.toHaveBeenCalled();
    expect(withWallet).not.toHaveBeenCalled();
    expect(mockPcztCreate).not.toHaveBeenCalled();
    expect(mockPcztSubmit).not.toHaveBeenCalled();
  });

  it('pins PCZT creation to the selected Ironwood pool', async () => {
    mockPcztCreate.mockReturnValue(
      JSON.stringify({ pcztHex: '0102', feeZat: 10_000 }),
    );

    await expect(
      createPczt(account, {
        toAddress: 't1-recipient',
        valueZat: '90000',
        spendSource: 'ironwood',
      }),
    ).resolves.toEqual({ pcztHex: '0102', feeZat: '10000' });

    expect(mockPcztCreate).toHaveBeenCalledWith(
      'account-uuid',
      't1-recipient',
      90_000n,
      null,
      3,
      10,
      'ironwood',
      true, // padOrchardBundle
      false, // allowZeroConfShielding
      'ironwood',
      null,
    );
  });

  it('always pins exactly one shielded pool (no cross-pool sends)', async () => {
    mockPcztQuote.mockReturnValue(JSON.stringify({ feeZat: 10_000, steps: 1 }));

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
      true, // padOrchardBundle
      false, // allowZeroConfShielding
      ZCASH_CURRENT_SHIELDED_POOL,
      null,
    );
  });

  it('passes quote and creation the same policy', async () => {
    mockPcztQuote.mockReturnValue(JSON.stringify({ feeZat: 10_000, steps: 1 }));
    mockPcztCreate.mockReturnValue(
      JSON.stringify({ pcztHex: '0102', feeZat: 10_000 }),
    );

    await quotePczt(account, {
      toAddress: 'u1-recipient',
      valueZat: '90000',
      spendSource: 'ironwood',
    });
    await createPczt(account, {
      toAddress: 'u1-recipient',
      valueZat: '90000',
      spendSource: 'ironwood',
    });

    // Both exports take the policy positionally; a field reaching only one of
    // them would quote a fee that is never paid.
    const quoted = mockPcztQuote.mock.calls[0] as unknown[];
    const created = mockPcztCreate.mock.calls[0] as unknown[];
    expect(quoted).toEqual(created);
  });

  it('submits in one runtime call without a reservation', async () => {
    mockPcztSubmit.mockResolvedValue(
      JSON.stringify({ txid: 'txid', broadcast: 'accepted' }),
    );

    await expect(submitPczt(account, { pcztHex: '0102' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'accepted',
      broadcastError: undefined,
    });
    expect(mockPcztSubmit).toHaveBeenCalledWith(
      'account-uuid',
      Uint8Array.from([1, 2]),
    );
  });

  it('reports an unknown outcome the runtime keeps pending until mined or expired', async () => {
    mockPcztSubmit.mockResolvedValue(
      JSON.stringify({
        txid: 'txid',
        broadcast: 'unknown',
        error: {
          code: 'NETWORK_ERROR',
          params: { operation: 'sendTransaction', timeoutMs: 30_000 },
          detail: null,
        },
      }),
    );

    await expect(submitPczt(account, { pcztHex: '0102' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'unknown',
      broadcastError: {
        code: 'NETWORK_ERROR',
        params: { operation: 'sendTransaction', timeoutMs: 30_000 },
        detail: undefined,
      },
    });
  });

  // The runtime records the rejection; the node reason is what the caller shows.
  it('passes a rejection through with the node reason', async () => {
    mockPcztSubmit.mockResolvedValue(
      JSON.stringify({
        txid: 'txid',
        broadcast: 'rejected',
        error: {
          code: 'BROADCAST_REJECTED',
          params: { errorCode: -26 },
          detail: 'bad-txns-inputs-missingorspent',
        },
      }),
    );

    await expect(submitPczt(account, { pcztHex: '0102' })).resolves.toEqual({
      txid: 'txid',
      broadcastState: 'rejected',
      broadcastError: {
        code: 'BROADCAST_REJECTED',
        params: { errorCode: -26 },
        detail: 'bad-txns-inputs-missingorspent',
      },
    });
  });

  // The runtime may have recorded and broadcast before the bridge dropped:
  // the caller must treat this as unknown, never as a clean failure.
  it('lets a bridge failure surface to the caller', async () => {
    mockPcztSubmit.mockRejectedValue(new Error('bridge disconnected'));

    await expect(submitPczt(account, { pcztHex: '0102' })).rejects.toThrow(
      'bridge disconnected',
    );
  });
});

describe('Zcash memo quote/create parity', () => {
  it('carries the same exact binary field through quoting and creation', async () => {
    const memoHex = `ff0102${'00'.repeat(509)}`;
    mockPcztQuote.mockReturnValue(JSON.stringify({ feeZat: 10_000 }));
    mockPcztCreate.mockReturnValue(
      JSON.stringify({ pcztHex: '0102', feeZat: 10_000 }),
    );
    const params = {
      toAddress: 'u1-test',
      valueZat: '20000',
      spendSource: 'ironwood' as const,
      memoHex,
    };
    await quotePczt(account, params);
    await createPczt(account, params);
    expect(mockPcztQuote).toHaveBeenLastCalledWith(
      'account-uuid',
      'u1-test',
      20_000n,
      null,
      3,
      10,
      'ironwood',
      true,
      false,
      'ironwood',
      memoHex,
    );
    expect(mockPcztCreate).toHaveBeenLastCalledWith(
      'account-uuid',
      'u1-test',
      20_000n,
      null,
      3,
      10,
      'ironwood',
      true,
      false,
      'ironwood',
      memoHex,
    );
  });
});
