import ServiceWalletConnectPay from './ServiceWalletConnectPay';

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

describe('isPaymentLink', () => {
  function buildCapabilityService(supportsDurableProgress: boolean) {
    const supportsDurableProgressFn = jest.fn(
      async () => supportsDurableProgress,
    );
    const service = new ServiceWalletConnectPay({
      backgroundApi: {
        simpleDb: {
          walletConnectPay: {
            supportsDurableProgress: supportsDurableProgressFn,
          },
        },
      },
    });
    return { service, supportsDurableProgressFn };
  }

  it('refuses even a valid payment link on platforms without durable progress', async () => {
    const { service, supportsDurableProgressFn } =
      buildCapabilityService(false);
    await expect(
      service.isPaymentLink({ uri: 'https://pay.walletconnect.com/pay_123' }),
    ).resolves.toBe(false);
    expect(supportsDurableProgressFn).toHaveBeenCalled();
  });

  it('rejects non-pay inputs before consulting platform capability', async () => {
    const { service, supportsDurableProgressFn } = buildCapabilityService(true);
    await expect(
      service.isPaymentLink({ uri: 'https://evil.com/?pid=pay_x' }),
    ).resolves.toBe(false);
    expect(supportsDurableProgressFn).not.toHaveBeenCalled();
  });
});
