import { EWcPayActionMethod } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';

import ServiceWalletConnectPay, {
  validateWcPayActions,
} from './ServiceWalletConnectPay';

import type { IWcPayBroadcastMeta } from '../../dbs/simple/entity/SimpleDbEntityWalletConnectPay';

// jest.mock calls are hoisted above the imports, so mocking below still
// applies. Keep the test import graph small: the base class and the
// walletconnect client module drag in the whole background runtime, none of
// which isTxNeverBroadcast touches
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../ServiceWalletConnect/walletConnectClient', () => ({
  __esModule: true,
  default: {},
}));
// skip the real 5s inter-round waits
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<{
    default: Record<string, unknown>;
  }>('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: { ...actual.default, wait: jest.fn(() => Promise.resolve()) },
  };
});

// the @backgroundClass constructor guard refuses to instantiate outside the
// background runtime
(
  globalThis as typeof globalThis & { $onekeyIsInBackground?: boolean }
).$onekeyIsInBackground = true;

const TXID = '0xtxid';
const SENDER = '0xsender';

type IRpcRequest = { method: string; params: unknown[] };

function buildService({
  rpcHandler,
  meta,
}: {
  // returns the array proxyRPCCall would resolve with; elements may be
  // promises to mirror the preset-network path (parseRPCResponse items are
  // returned unresolved inside the array)
  rpcHandler: (request: IRpcRequest) => unknown[] | Promise<never>;
  meta: IWcPayBroadcastMeta | undefined;
}) {
  const proxyRPCCall = jest.fn(async ({ request }: { request: IRpcRequest }) =>
    rpcHandler(request),
  );
  const findBroadcastMetaByTxid = jest.fn(async () => meta);
  const backgroundApi = {
    serviceDApp: { proxyRPCCall },
    simpleDb: { walletConnectPay: { findBroadcastMetaByTxid } },
  };
  const service = new ServiceWalletConnectPay({ backgroundApi });
  return { service, proxyRPCCall, findBroadcastMetaByTxid };
}

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/ServiceWalletConnectPay.test.ts
describe('isTxNeverBroadcast', () => {
  it('returns true when all probes answer null through promise elements and nothing occupies the nonce', async () => {
    const { service, proxyRPCCall } = buildService({
      rpcHandler: ({ method }) => {
        if (method === 'eth_getTransactionCount') {
          // confirmed == pending == nonce → the phantom nonce is still the
          // next slot and this node sees nothing pending from the sender
          return [Promise.resolve('0x5')];
        }
        return [Promise.resolve(null)];
      },
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(true);
    // 3 rounds × (tx + receipt) + latest + pending nonce lookups
    expect(proxyRPCCall).toHaveBeenCalledTimes(8);
    expect(proxyRPCCall).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          method: 'eth_getTransactionCount',
          params: [SENDER, 'latest'],
        },
      }),
    );
    expect(proxyRPCCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: {
          method: 'eth_getTransactionCount',
          params: [SENDER, 'pending'],
        },
      }),
    );
  });

  it('returns false as soon as a probe finds the transaction', async () => {
    const { service, proxyRPCCall } = buildService({
      rpcHandler: () => [Promise.resolve({ hash: TXID })],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
    expect(proxyRPCCall).toHaveBeenCalledTimes(1);
  });

  it('returns false when the sender nonce was already consumed on chain', async () => {
    const { service } = buildService({
      rpcHandler: ({ method }) =>
        method === 'eth_getTransactionCount'
          ? [Promise.resolve('0x6')]
          : [Promise.resolve(null)],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
  });

  it('returns false when the node sees a pending tx from the sender — likely the phantom itself', async () => {
    const { service } = buildService({
      rpcHandler: ({ method, params }) => {
        if (method === 'eth_getTransactionCount') {
          return params[1] === 'pending'
            ? [Promise.resolve('0x6')]
            : [Promise.resolve('0x5')];
        }
        return [Promise.resolve(null)];
      },
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
  });

  it('returns false when the confirmed count is below the recorded nonce — account state inconsistent with the record', async () => {
    const { service } = buildService({
      rpcHandler: ({ method }) =>
        method === 'eth_getTransactionCount'
          ? [Promise.resolve('0x4')]
          : [Promise.resolve(null)],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
  });

  it('returns false when no broadcast metadata was recorded for the txid', async () => {
    const { service, findBroadcastMetaByTxid } = buildService({
      rpcHandler: () => [Promise.resolve(null)],
      meta: undefined,
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
    expect(findBroadcastMetaByTxid).toHaveBeenCalledWith({ txid: TXID });
  });

  it('treats an empty response envelope as an RPC error, not as "not found"', async () => {
    const { service, proxyRPCCall } = buildService({
      rpcHandler: () => [],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
    expect(proxyRPCCall).toHaveBeenCalledTimes(1);
  });

  it('returns false when the nonce lookup itself fails', async () => {
    const { service } = buildService({
      rpcHandler: ({ method }) =>
        method === 'eth_getTransactionCount'
          ? Promise.reject(new Error('rpc down'))
          : [Promise.resolve(null)],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
  });

  it('returns false when the nonce lookup returns a non-numeric value', async () => {
    const { service } = buildService({
      rpcHandler: ({ method }) =>
        method === 'eth_getTransactionCount'
          ? [Promise.resolve('not-a-number')]
          : [Promise.resolve(null)],
      meta: { sender: SENDER, nonce: 5 },
    });
    await expect(
      service.isTxNeverBroadcast({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toBe(false);
  });
});

describe('waitForTxMined', () => {
  it('keeps polling while the receipt promise resolves null, then reports success', async () => {
    // regression: the null receipt arrives wrapped in an unresolved promise
    // (preset-network shape); treating the bare promise object as a receipt
    // would return { isReverted: false } on the first round without waiting
    let calls = 0;
    const { service, proxyRPCCall } = buildService({
      rpcHandler: () => {
        calls += 1;
        return calls < 3
          ? [Promise.resolve(null)]
          : [Promise.resolve({ status: '0x1' })];
      },
      meta: undefined,
    });
    await expect(
      service.waitForTxMined({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toEqual({ isReverted: false });
    expect(proxyRPCCall).toHaveBeenCalledTimes(3);
  });

  it('reports a reverted receipt delivered through a promise element', async () => {
    const { service } = buildService({
      rpcHandler: () => [Promise.resolve({ status: '0x0' })],
      meta: undefined,
    });
    await expect(
      service.waitForTxMined({ networkId: 'evm--8453', txid: TXID }),
    ).resolves.toEqual({ isReverted: true });
  });

  it('times out when the receipt never appears', async () => {
    const { service } = buildService({
      rpcHandler: () => [Promise.resolve(null)],
      meta: undefined,
    });
    await expect(
      service.waitForTxMined({
        networkId: 'evm--8453',
        txid: TXID,
        timeoutMs: -1,
      }),
    ).rejects.toThrow('Timed out waiting for transaction confirmation');
  });
});

describe('getStoredActionResults', () => {
  const KEYS = {
    paymentId: 'pay-1',
    optionId: 'opt-1',
    accountKey: 'acc-1',
  };
  // valid params so the action itself fingerprints fine; the stored entry
  // carries a stale fingerprint so the record diverges
  const divergentActions = [
    {
      walletRpc: {
        chainId: 'eip155:8453',
        method: 'eth_sendTransaction',
        params: '[{"to":"0x1"}]',
      },
    },
  ] as never[];

  function buildProgressService(entries: unknown[]) {
    const getProgress = jest.fn(async () => ({ entries }));
    const removeProgress = jest.fn(async () => {});
    const backgroundApi = {
      simpleDb: { walletConnectPay: { getProgress, removeProgress } },
    };
    const service = new ServiceWalletConnectPay({ backgroundApi });
    return { service, removeProgress };
  }

  it('refuses instead of deleting when a divergent record carries broadcast evidence', async () => {
    // deleting a txid-bearing record would destroy the only
    // duplicate-payment evidence and let the fresh attempt pay twice
    const { service, removeProgress } = buildProgressService([
      {
        fingerprint: 'stale-fp',
        result: '0xdeadbeef',
        broadcastMeta: { sender: SENDER, nonce: 7 },
      },
    ]);

    await expect(
      service.getStoredActionResults({ ...KEYS, actions: divergentActions }),
    ).rejects.toThrow('This payment cannot be resumed safely on this device');
    expect(removeProgress).not.toHaveBeenCalled();
  });

  it('still discards a divergent record that holds no broadcast evidence', async () => {
    const { service, removeProgress } = buildProgressService([
      { fingerprint: 'stale-fp', result: '0xsignature' },
    ]);

    await expect(
      service.getStoredActionResults({ ...KEYS, actions: divergentActions }),
    ).resolves.toEqual([]);
    expect(removeProgress).toHaveBeenCalledWith(KEYS);
  });
});

describe('isPaymentLink', () => {
  it('rejects non-pay inputs by the cheap domain filter', async () => {
    // recognition is platform-independent: no capability stubs required
    const service = new ServiceWalletConnectPay({ backgroundApi: {} });
    await expect(
      service.isPaymentLink({ uri: 'https://evil.com/?pid=pay_x' }),
    ).resolves.toBe(false);
  });
});

describe('validateWcPayActions solana', () => {
  const SOLANA_CHAIN_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

  function buildSolanaAction(transaction: string) {
    return {
      walletRpc: {
        chainId: SOLANA_CHAIN_ID,
        method: EWcPayActionMethod.SolanaSignTransaction,
        params: JSON.stringify([{ transaction }]),
      },
    };
  }

  it('rejects a payload the executor could not encode — same pair of functions', async () => {
    // '!!!!' base64-decodes to zero bytes: extractWcPaySolanaTransaction
    // alone accepts it, wcPaySolanaTxToEncodedTx throws
    expect(() => validateWcPayActions([buildSolanaAction('!!!!')])).toThrow();
  });

  it('accepts a decodable size-sane payload', async () => {
    expect(() =>
      validateWcPayActions([buildSolanaAction('AQID')]),
    ).not.toThrow();
  });
});

// These two wrappers exist so the UI runtime never has to import
// @solana/web3.js (see their doc comment in the service); the checks
// themselves are covered exhaustively in wcPaySolanaConsistency.test.ts, so
// this suite only proves the wrappers reach the real validators.
describe('solana order check background methods', () => {
  const SOLANA_CHAIN_ID = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
  const service = new ServiceWalletConnectPay({ backgroundApi: {} });

  it('refuses an option whose account is not a CAIP-10 address', async () => {
    const option: IWcPayOption = {
      id: 'opt-1',
      account: 'bad',
      amount: {
        unit: 'SOL',
        value: '1500',
        display: { assetSymbol: 'SOL', assetName: 'Solana', decimals: 9 },
      },
      etaS: 10,
      actions: [],
    };
    await expect(
      service.checkSolanaTxMatchesOrder({
        txBase64: 'AQID',
        caip2ChainId: SOLANA_CHAIN_ID,
        option,
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid option account shape' });
  });

  it('reports a message as changed when neither blob decodes', async () => {
    await expect(
      service.isSolanaMessageUnchanged({
        unsignedBase64: '',
        signedBase64: '',
      }),
    ).resolves.toBe(false);
  });
});
