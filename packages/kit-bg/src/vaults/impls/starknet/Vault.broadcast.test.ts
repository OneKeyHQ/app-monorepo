import type { IEncodedTxStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ESignedTxBroadcastStatus } from '../../types';

import { STRK20_SCREENING_WINDOW_MS } from './sdkStarknet';
import { JsonRpcTransport } from './sdkStarknet/JsonRpcTransport';
import { OneKeyTransport } from './sdkStarknet/OneKeyTransport';
import StarknetVault from './Vault';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

/*
yarn jest packages/kit-bg/src/vaults/impls/starknet/Vault.broadcast.test.ts

A deposit's screening attestation expires, so a build the user sat on must be
refused locally instead of burning a real fee on a SCREENING_REQUIRED revert.
*/
const POOL =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';

const baseEncodedTx = {
  chainId: '0x534e5f5345504f4c4941',
  from: '0x1',
  version: '0x3',
  nonce: '0x1',
  calls: [],
  resourceBounds: {
    l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
  },
  tip: '0x0',
  paymasterData: [],
  accountDeploymentData: [],
  nonceDataAvailabilityMode: 'L1',
  feeDataAvailabilityMode: 'L1',
} as IEncodedTxStarknet;

function privacyTx(kind: string, builtAt: number): IEncodedTxStarknet {
  return {
    ...baseEncodedTx,
    privacy: {
      poolAddress: POOL,
      kind,
      proofFacts: ['0xaa'],
      proof: '0xproof',
      provingBlockId: 991,
      builtAt,
    },
  } as IEncodedTxStarknet;
}

const noteRegisterSubmitted = jest.fn(async () => undefined);
const notePrivateTransferSubmitted = jest.fn(async () => undefined);
const assertPrivacyTxCanSubmit = jest.fn(async (_p?: unknown) => undefined);

function buildVault() {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  const addInvokeTransaction = jest.fn(async () => ({
    transaction_hash: '0xabc',
  }));
  Object.assign(vault, {
    networkId: 'starknet--sepolia',
    accountId: 'hd-1--a',
    backgroundApi: {
      serviceStarknetPrivacy: {
        noteRegisterSubmitted,
        notePrivateTransferSubmitted,
        assertPrivacyTxCanSubmit,
        withPrivacyTxSubmitLock: async (
          p: unknown,
          fn: () => Promise<unknown>,
        ) => {
          await assertPrivacyTxCanSubmit(p);
          return fn();
        },
      },
    },
  });
  return { vault, addInvokeTransaction };
}

beforeEach(() => {
  notePrivateTransferSubmitted.mockReset();
  assertPrivacyTxCanSubmit.mockReset();
  noteRegisterSubmitted.mockReset();
  noteRegisterSubmitted.mockResolvedValue(undefined);
});

async function broadcast(
  encodedTx: IEncodedTxStarknet,
  options?: {
    latestBlock?: number;
    proofValidityBlocks?: number;
  },
) {
  const { vault, addInvokeTransaction } = buildVault();
  const getBlockNumber = jest.fn(async () => options?.latestBlock ?? 1000);
  const getPoolProofValidityBlocks = jest.fn(
    async () => options?.proofValidityBlocks ?? 100,
  );
  const signedTx = {
    txid: '0xabc',
    rawTx: JSON.stringify({
      invoke: { type: 'INVOKE' },
      invokeTxHash: '0xabc',
    }),
    encodedTx,
  };
  const promise = (
    vault as unknown as {
      _broadcast: (p: unknown) => Promise<unknown>;
    }
  )._broadcast({
    client: {
      addInvokeTransaction,
      getBlockNumber,
      getPoolProofValidityBlocks,
    },
    signedTx,
  });
  return {
    promise,
    addInvokeTransaction,
    getBlockNumber,
    getPoolProofValidityBlocks,
  };
}

it.each([
  { enabled: false, useDefaultRpc: true, expectCustom: false },
  { enabled: true, useDefaultRpc: false, expectCustom: true },
  { enabled: true, useDefaultRpc: true, expectCustom: false },
])(
  'honors a one-time broadcast node choice (%o)',
  async ({ enabled, useDefaultRpc, expectCustom }) => {
    const serviceCustomRpc = {
      getCustomRpcForNetwork: async () => ({
        rpc: 'https://node.invalid',
        enabled,
      }),
    };
    const account = { networkId: 'starknet--sepolia', accountId: 'hd-1--a' };
    const vault = new StarknetVault({
      ...account,
      backgroundApi: { serviceCustomRpc } as unknown as IBackgroundApi,
    });
    const result = { transaction_hash: '0xabc' };
    const custom = jest
      .spyOn(JsonRpcTransport.prototype, 'request')
      .mockResolvedValue(result);
    const proxy = jest
      .spyOn(OneKeyTransport.prototype, 'request')
      .mockResolvedValue(result);
    try {
      await vault.broadcastTransaction({
        ...account,
        accountAddress: baseEncodedTx.from,
        useDefaultRpc,
        signedTx: {
          txid: result.transaction_hash,
          rawTx: JSON.stringify({
            invokeTxHash: result.transaction_hash,
            invoke: { type: 'INVOKE' },
          }),
          encodedTx: baseEncodedTx,
        },
      });
      expect(custom).toHaveBeenCalledTimes(expectCustom ? 1 : 0);
      expect(proxy).toHaveBeenCalledTimes(expectCustom ? 0 : 1);
    } finally {
      custom.mockRestore();
      proxy.mockRestore();
    }
  },
);

describe('StarknetVault privacy build freshness', () => {
  it.each([true, false])(
    'reconciles a batch item from its receipt without treating an unknown receipt as rejection (%s)',
    async (hasReceipt) => {
      const { vault } = buildVault();
      const getTransactionReceipt = jest.fn(async () =>
        hasReceipt ? { execution_status: 'SUCCEEDED' } : null,
      );
      jest
        .spyOn(vault, 'getClient')
        .mockResolvedValue({ getTransactionReceipt } as unknown as Awaited<
          ReturnType<StarknetVault['getClient']>
        >);
      expect(
        await vault.checkSignedTxBroadcastStatus({
          signedTx: { txid: '0xabc', rawTx: '', encodedTx: baseEncodedTx },
          attemptedAt: 1,
        }),
      ).toBe(
        hasReceipt
          ? ESignedTxBroadcastStatus.Broadcast
          : ESignedTxBroadcastStatus.Unknown,
      );
      expect(getTransactionReceipt).toHaveBeenCalledWith('0xabc');
    },
  );

  it('reconciles privacy state when checkSignedTxBroadcastStatus recovers an accepted broadcast', async () => {
    const { vault } = buildVault();
    const getTransactionReceipt = jest.fn(async () => ({
      execution_status: 'SUCCEEDED',
    }));
    jest
      .spyOn(vault, 'getClient')
      .mockResolvedValue({ getTransactionReceipt } as unknown as Awaited<
        ReturnType<StarknetVault['getClient']>
      >);
    expect(
      await vault.checkSignedTxBroadcastStatus({
        signedTx: {
          txid: '0xreg1',
          rawTx: '',
          encodedTx: privacyTx('register', Date.now()),
        },
        attemptedAt: 1,
      }),
    ).toBe(ESignedTxBroadcastStatus.Broadcast);
    expect(noteRegisterSubmitted).toHaveBeenCalledWith({
      networkId: 'starknet--sepolia',
      accountId: 'hd-1--a',
      poolAddress: POOL,
      txid: '0xreg1',
    });
  });

  it('broadcasts a standard batch activation without sending an Invoke', async () => {
    const { vault, addInvokeTransaction } = buildVault();
    const addDeployAccountTransaction = jest.fn(async () => ({
      transaction_hash: '0xdef',
    }));
    const result = await (
      vault as unknown as {
        _broadcast: (params: unknown) => Promise<{ txid: string }>;
      }
    )._broadcast({
      client: { addDeployAccountTransaction, addInvokeTransaction },
      signedTx: {
        txid: '0xdef',
        encodedTx: { ...baseEncodedTx, type: 'DEPLOY_ACCOUNT' },
        rawTx: JSON.stringify({
          type: 'DEPLOY_ACCOUNT',
          deployAccount: { type: 'DEPLOY_ACCOUNT' },
          deployAccountTxHash: '0xdef',
        }),
      },
    });
    expect(result.txid).toBe('0xdef');
    expect(addDeployAccountTransaction).toHaveBeenCalledTimes(1);
    expect(addInvokeTransaction).not.toHaveBeenCalled();
  });

  it('refuses a deposit built outside the screening window', async () => {
    const { promise, addInvokeTransaction } = await broadcast(
      privacyTx('deposit', Date.now() - STRK20_SCREENING_WINDOW_MS - 1000),
    );

    await expect(promise).rejects.toThrow();
    expect(addInvokeTransaction).not.toHaveBeenCalled();
  });

  it('submits a deposit still inside the window', async () => {
    const { promise, addInvokeTransaction } = await broadcast(
      privacyTx('deposit', Date.now() - 1000),
    );

    await promise;
    expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
  });

  it.each(['withdraw', 'transfer', 'register'])(
    'does not time-box a %s, which carries no attestation',
    async (kind) => {
      const { promise, addInvokeTransaction } = await broadcast(
        privacyTx(kind, Date.now() - STRK20_SCREENING_WINDOW_MS - 60_000),
      );

      await promise;
      expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['deposit', 'withdraw', 'transfer', 'register'])(
    'refuses a %s when provingBlockId exceeds the pool proof validity window',
    async (kind) => {
      const { promise, addInvokeTransaction } = await broadcast(
        privacyTx(kind, Date.now() - 1000),
        { latestBlock: 1091, proofValidityBlocks: 100 },
      );

      await expect(promise).rejects.toMatchObject({
        data: { starknetPrivacyErrorCode: 'proof_expired' },
      });
      expect(addInvokeTransaction).not.toHaveBeenCalled();
    },
  );

  it('leaves an ordinary transparent send alone', async () => {
    const { promise, addInvokeTransaction } = await broadcast(baseEncodedTx);

    await promise;
    expect(addInvokeTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('StarknetVault register submission', () => {
  it('marks opt-in pending once the node accepts a register tx', async () => {
    const { promise } = await broadcast(privacyTx('register', Date.now()));

    await promise;
    expect(noteRegisterSubmitted).toHaveBeenCalledWith({
      networkId: 'starknet--sepolia',
      accountId: 'hd-1--a',
      poolAddress: POOL,
      txid: '0xabc',
    });
  });

  it.each(['deposit', 'withdraw', 'transfer'])(
    'does not touch opt-in for a %s',
    async (kind) => {
      const { promise } = await broadcast(privacyTx(kind, Date.now()));

      await promise;
      expect(noteRegisterSubmitted).not.toHaveBeenCalled();
    },
  );

  it('still returns the txid when recording the register fails', async () => {
    noteRegisterSubmitted.mockRejectedValue(new Error('db down'));
    const { promise } = await broadcast(privacyTx('register', Date.now()));

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ txid: '0xabc' }),
    );
  });
});

it('does not broadcast when privacy has been disabled since preparation', async () => {
  assertPrivacyTxCanSubmit.mockRejectedValue(new Error('Privacy unavailable'));
  const { promise, addInvokeTransaction } = await broadcast(
    privacyTx('deposit', Date.now()),
  );
  await expect(promise).rejects.toThrow('Privacy unavailable');
  expect(addInvokeTransaction).not.toHaveBeenCalled();
});
it.each(['deposit', 'withdraw', 'transfer'])(
  'records the accepted %s transaction for status tracking',
  async (kind) => {
    const { promise } = await broadcast(privacyTx(kind, Date.now()));
    await promise;
    expect(notePrivateTransferSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ kind, txid: '0xabc' }),
    );
  },
);

it.each(['INVOKE', 'DEPLOY_ACCOUNT'] as const)(
  'rejects a different RPC hash after %s without accepting it as the wallet transaction',
  async (kind) => {
    const { vault, addInvokeTransaction } = buildVault();
    addInvokeTransaction.mockResolvedValue({ transaction_hash: '0x999' });
    const addDeployAccountTransaction = jest.fn(async () => ({
      transaction_hash: '0x999',
    }));
    const raw =
      kind === 'INVOKE'
        ? { invoke: { type: kind }, invokeTxHash: '0xabc' }
        : {
            type: kind,
            deployAccount: { type: kind },
            deployAccountTxHash: '0xabc',
          };
    await expect(
      (
        vault as unknown as { _broadcast: (p: unknown) => Promise<unknown> }
      )._broadcast({
        client: { addInvokeTransaction, addDeployAccountTransaction },
        signedTx: {
          txid: '0xabc',
          encodedTx: baseEncodedTx,
          rawTx: JSON.stringify(raw),
        },
      }),
    ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
    expect(notePrivateTransferSubmitted).not.toHaveBeenCalled();
  },
);

it('accepts RPC padding without changing the locally signed transaction ID', async () => {
  const { vault } = buildVault();
  const signedTx = {
    txid: '0xabc',
    encodedTx: baseEncodedTx,
    rawTx: JSON.stringify({
      invoke: { type: 'INVOKE' },
      invokeTxHash: '0xabc',
    }),
  };
  const result = await (
    vault as unknown as {
      _broadcast: (p: unknown) => Promise<{ txid: string }>;
    }
  )._broadcast({
    client: {
      addInvokeTransaction: async () => ({
        transaction_hash: `0x${'abc'.padStart(64, '0')}`,
      }),
    },
    signedTx,
  });
  expect(result.txid).toBe(signedTx.txid);
});

it('rejects a signed ID inconsistent with its payload before broadcasting', async () => {
  const { vault, addInvokeTransaction } = buildVault();
  await expect(
    (
      vault as unknown as { _broadcast: (p: unknown) => Promise<unknown> }
    )._broadcast({
      client: { addInvokeTransaction },
      signedTx: {
        txid: '0x999',
        encodedTx: baseEncodedTx,
        rawTx: JSON.stringify({
          invoke: { type: 'INVOKE' },
          invokeTxHash: '0xabc',
        }),
      },
    }),
  ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
  expect(addInvokeTransaction).not.toHaveBeenCalled();
});
