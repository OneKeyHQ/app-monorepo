/*
yarn test packages/kit-bg/src/services/ServiceSend.precheckReplaceTxNonce.test.ts

Covers the replace-tx (speed up / cancel) nonce safeguards that prevent the
backend "nonce already used" rejection (code 40024):
- precheckReplaceTxNonceConsumed: on-chain nonce re-validation + fail-open
- isReplaceTxNonceAlreadyUsedServerError: backend 40024 detection
*/

// --- mocks MUST be defined before the import of ServiceSend below ---
// ESM-only deps that jest cannot parse from node_modules.
jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

// eslint-disable-next-line import-js/order, import/first
import { SEND_TX_SERVER_ERROR_CODES } from '@onekeyhq/shared/src/engine/engineConsts';
// eslint-disable-next-line import-js/order, import/first
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

function makeService(overrides: {
  nonceRequired?: boolean;
  onChainNextNonce?: number | null | undefined;
  fetchAccountDetails?: jest.Mock;
  // backend-indexed flag of the network (defaults to indexed -> wallet API)
  backendIndex?: boolean;
  getNetworkSafe?: jest.Mock;
  // custom RPC path
  customRpcInfo?: { rpc?: string; enabled?: boolean };
  getCustomRpcForNetwork?: jest.Mock;
  fetchAccountDetailsByRpc?: jest.Mock;
  rpcNextNonce?: number | null | undefined;
}) {
  const fetchAccountDetails =
    overrides.fetchAccountDetails ??
    jest.fn().mockResolvedValue({ nonce: overrides.onChainNextNonce });
  const fetchAccountDetailsByRpc =
    overrides.fetchAccountDetailsByRpc ??
    jest
      .fn()
      .mockResolvedValue({ data: { data: { nonce: overrides.rpcNextNonce } } });
  const getCustomRpcForNetwork =
    overrides.getCustomRpcForNetwork ??
    jest.fn().mockResolvedValue(overrides.customRpcInfo);
  const getNetworkSafe =
    overrides.getNetworkSafe ??
    jest
      .fn()
      .mockResolvedValue({ backendIndex: overrides.backendIndex ?? true });

  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    fetchAccountDetailsByRpc,
  });

  const backgroundApi = {
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({
        nonceRequired: overrides.nonceRequired ?? true,
      }),
      getNetworkSafe,
    },
    serviceAccountProfile: {
      fetchAccountDetails,
    },
    serviceCustomRpc: {
      getCustomRpcForNetwork,
    },
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue('0xabc'),
    },
  };
  const svc = (() => {
    const Ctor = ServiceSend as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceSend;
    return new Ctor({ backgroundApi });
  })();
  return Object.assign(svc, {
    __mocks: { fetchAccountDetails, fetchAccountDetailsByRpc, getNetworkSafe },
  }) as ServiceSend & {
    __mocks: {
      fetchAccountDetails: jest.Mock;
      fetchAccountDetailsByRpc: jest.Mock;
      getNetworkSafe: jest.Mock;
    };
  };
}

describe('ServiceSend.precheckReplaceTxNonceConsumed', () => {
  test('nonce already consumed on-chain (target < onChainNext) → consumed', async () => {
    const svc = makeService({ onChainNextNonce: 1 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: true, onChainNextNonce: 1 });
  });

  test('original tx still pending (target === onChainNext) → not consumed', async () => {
    const svc = makeService({ onChainNextNonce: 0 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 0 });
  });

  test('nonce gap (target > onChainNext) → not consumed (still replaceable)', async () => {
    const svc = makeService({ onChainNextNonce: 4 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 4 });
  });

  test('non-nonce chain → not consumed, skips on-chain fetch', async () => {
    const fetchAccountDetails = jest.fn();
    const svc = makeService({ nonceRequired: false, fetchAccountDetails });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'btc--0',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: false });
    expect(fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('fail-open when on-chain fetch throws → not consumed', async () => {
    const svc = makeService({
      fetchAccountDetails: jest.fn().mockRejectedValue(new Error('network')),
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
  });

  test('fail-open when on-chain nonce is nil → not consumed', async () => {
    const svc = makeService({ onChainNextNonce: undefined });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
  });

  test('custom RPC enabled → reads nonce from the RPC node, not the wallet API', async () => {
    // wallet API still reports the old nonce (target not yet consumed), but the
    // custom RPC node has already advanced past it -> must be detected consumed.
    const svc = makeService({
      onChainNextNonce: 5,
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: true },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: true, onChainNextNonce: 6 });
    expect(svc.__mocks.fetchAccountDetailsByRpc).toHaveBeenCalledTimes(1);
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('custom RPC enabled but useDefaultRpc=true → reads from the wallet API', async () => {
    const svc = makeService({
      onChainNextNonce: 5,
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: true },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
      useDefaultRpc: true,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 5 });
    expect(svc.__mocks.fetchAccountDetails).toHaveBeenCalledTimes(1);
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
  });

  test('custom RPC present but disabled → reads from the wallet API', async () => {
    const svc = makeService({
      onChainNextNonce: 5,
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: false },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 5 });
    expect(svc.__mocks.fetchAccountDetails).toHaveBeenCalledTimes(1);
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
  });

  test('custom RPC lookup throws → falls back to wallet API (does not fail-open)', async () => {
    const svc = makeService({
      onChainNextNonce: 9,
      getCustomRpcForNetwork: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: true, onChainNextNonce: 9 });
    expect(svc.__mocks.fetchAccountDetails).toHaveBeenCalledTimes(1);
  });

  // OK-57049: on backend non-indexed networks the wallet API proxies the node
  // with the `pending` tag and returns the still-pending tx's own nonce + 1,
  // which previously made a replaceable tx look consumed and got it dropped.
  // The precheck must never use the wallet API for these networks: it reads
  // the confirmed (latest) nonce from the ENABLED custom RPC only when the
  // broadcast itself goes through that node, and otherwise skips the precheck
  // explicitly (fail-open) — without an enabled custom RPC there is no usable
  // client-side nonce source, and a node the user bypassed via `useDefaultRpc`
  // must not drive the blocking consumed verdict.
  test('non-indexed network + enabled custom RPC + useDefaultRpc → precheck skipped, bypassed node never read', async () => {
    const svc = makeService({
      backendIndex: false,
      // wallet API would report N+1 (pending) -> would falsely flag consumed
      onChainNextNonce: 6,
      // the custom node was bypassed because it is unusable — a lagging or
      // forked view like this must not flag the pending as consumed
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: true },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--800001',
      targetNonce: 5,
      useDefaultRpc: true,
    });
    expect(result).toEqual({ consumed: false });
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('non-indexed network + enabled custom RPC → confirmed nonce past target still detected consumed', async () => {
    const svc = makeService({
      backendIndex: false,
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: true },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--800001',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: true, onChainNextNonce: 6 });
    expect(svc.__mocks.fetchAccountDetailsByRpc).toHaveBeenCalledTimes(1);
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('non-indexed network without custom RPC → precheck skipped (fail-open), no source read', async () => {
    const svc = makeService({
      backendIndex: false,
      onChainNextNonce: 6,
      rpcNextNonce: 6,
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--800001',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('non-indexed network + disabled custom RPC → precheck skipped, disabled node never read', async () => {
    const svc = makeService({
      backendIndex: false,
      onChainNextNonce: 6,
      rpcNextNonce: 6,
      customRpcInfo: { rpc: 'https://custom.rpc', enabled: false },
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--800001',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('indexed network → reads from the wallet API (RPC untouched)', async () => {
    const svc = makeService({
      backendIndex: true,
      onChainNextNonce: 5,
      rpcNextNonce: 6,
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 5 });
    expect(svc.__mocks.fetchAccountDetails).toHaveBeenCalledTimes(1);
    expect(svc.__mocks.fetchAccountDetailsByRpc).not.toHaveBeenCalled();
  });

  test('network lookup throws → precheck skipped, wallet API never read', async () => {
    const svc = makeService({
      onChainNextNonce: 9,
      getNetworkSafe: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('missing backendIndex → precheck skipped, wallet API never read', async () => {
    const svc = makeService({
      onChainNextNonce: 9,
      getNetworkSafe: jest.fn().mockResolvedValue({}),
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
    expect(svc.__mocks.fetchAccountDetails).not.toHaveBeenCalled();
  });
});

describe('ServiceSend.isReplaceTxNonceAlreadyUsedServerError', () => {
  const svc = makeService({});

  test('matches OneKeyServerApiError with the nonce-used code', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED,
      }),
    ).toBe(true);
  });

  test('rejects other server error codes', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 50_000,
      }),
    ).toBe(false);
  });

  test('rejects non-server errors that happen to carry the code', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyError,
        code: SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED,
      }),
    ).toBe(false);
  });

  test('handles undefined / non-error inputs', () => {
    expect(svc.isReplaceTxNonceAlreadyUsedServerError(undefined)).toBe(false);
    expect(svc.isReplaceTxNonceAlreadyUsedServerError('boom')).toBe(false);
  });
});

describe('ServiceSend.isReplaceTxNonceAlreadyUsedRpcError', () => {
  const svc = makeService({});

  test('matches genuine nonce-too-low RPC errors', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedRpcError({
        message: 'Error JSON RPC response: nonce too low',
      }),
    ).toBe(true);
    expect(
      svc.isReplaceTxNonceAlreadyUsedRpcError({
        message: 'nonce is too low: next nonce 6, tx nonce 5',
      }),
    ).toBe(true);
    expect(
      svc.isReplaceTxNonceAlreadyUsedRpcError({ message: 'OldNonce' }),
    ).toBe(true);
  });

  test('does NOT match replacement-underpriced (original tx still pending)', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedRpcError({
        message: 'replacement transaction underpriced',
      }),
    ).toBe(false);
  });

  test('does NOT match unrelated RPC errors', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedRpcError({
        message: 'insufficient funds for gas * price + value',
      }),
    ).toBe(false);
  });

  test('handles undefined / non-error inputs', () => {
    expect(svc.isReplaceTxNonceAlreadyUsedRpcError(undefined)).toBe(false);
    expect(svc.isReplaceTxNonceAlreadyUsedRpcError('boom')).toBe(false);
    expect(svc.isReplaceTxNonceAlreadyUsedRpcError({})).toBe(false);
  });
});
