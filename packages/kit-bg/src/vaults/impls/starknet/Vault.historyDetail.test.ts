import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import {
  EOnChainHistoryTxStatus,
  type IAccountHistoryTx,
} from '@onekeyhq/shared/types/history';

import { STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';
import StarknetVault from './Vault';

import type { IStarknetReceipt } from './sdkStarknet';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const NETWORK = {
  id: 'starknet--sepolia',
  decimals: 18,
  symbol: 'STRK',
  feeMeta: { decimals: 18, symbol: 'STRK' },
};

const TXID = '0x2abc';
const ACCOUNT_ID = 'hd-1--a';

function buildVault(receipt: IStarknetReceipt | null) {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  const noteAccountTouchedByTx = jest.fn(async () => undefined);
  Object.assign(vault, {
    networkId: NETWORK.id,
    accountId: ACCOUNT_ID,
    backgroundApi: {
      serviceStarknetPrivacy: { noteAccountTouchedByTx },
    },
    getNetwork: async () => NETWORK,
    getClient: async () => ({
      getTransactionReceipt: jest.fn(async () => receipt),
    }),
  });
  return { vault, noteAccountTouchedByTx };
}

async function runDetail(receipt: IStarknetReceipt | null) {
  const { vault, noteAccountTouchedByTx } = buildVault(receipt);
  const resp = await vault.fetchAccountHistoryDetail({
    accountId: ACCOUNT_ID,
    networkId: NETWORK.id,
    txid: TXID,
  });
  return { detail: resp.data.data.data, noteAccountTouchedByTx };
}

async function detailOf(receipt: IStarknetReceipt | null) {
  return (await runDetail(receipt)).detail;
}

describe('StarknetVault.fetchAccountHistoryDetail receipt shapes', () => {
  // spec 0.9.0 and 0.10.2 return the same field names; the only variation
  // observed live is execution_status and the optional revert_reason
  it('maps a SUCCEEDED receipt to Success and converts the fee to STRK', async () => {
    const detail = await detailOf({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      actual_fee: { amount: '0xde0b6b3a7640000', unit: 'FRI' },
      block_number: 15_196_592,
    });
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Success);
    expect(detail.gasFee).toBe('1');
    expect(detail.block).toBe(15_196_592);
    expect(detail.tx).toBe(TXID);
    expect(detail.gasFeeFiatValue).toBeUndefined();
  });

  it('maps a REVERTED receipt carrying revert_reason to Failed', async () => {
    const detail = await detailOf({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'REVERTED',
      finality_status: 'ACCEPTED_ON_L2',
      actual_fee: { amount: '0x2386f26fc10000', unit: 'FRI' },
      block_number: 900,
      revert_reason: 'ERC20: insufficient balance',
    });
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Failed);
    expect(detail.gasFee).toBe('0.01');
  });

  it('stays Pending when the node has not seen the hash', async () => {
    const detail = await detailOf(null);
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Pending);
    expect(detail.gasFee).toBeUndefined();
    expect(detail.block).toBeUndefined();
  });

  // A receipt can report SUCCEEDED while the sequencer can still drop the
  // transaction, so finality decides whether it has really landed.
  it.each(['RECEIVED', 'CANDIDATE', 'PRE_CONFIRMED'] as const)(
    'stays Pending while finality is %s, even when execution SUCCEEDED',
    async (finalityStatus) => {
      const detail = await detailOf({
        transaction_hash: TXID,
        type: 'INVOKE',
        execution_status: 'SUCCEEDED',
        finality_status: finalityStatus,
      });
      expect(detail.status).toBe(EOnChainHistoryTxStatus.Pending);
      expect(detail.gasFee).toBeUndefined();
    },
  );

  it('accepts an L1-final receipt as Success', async () => {
    const detail = await detailOf({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L1',
      block_number: 10,
    });
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Success);
  });

  it('resolves a REJECTED receipt to Failed rather than polling forever', async () => {
    const detail = await detailOf({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'REJECTED',
    });
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Failed);
  });

  it('tolerates an accepted receipt with no actual_fee or block_number', async () => {
    const detail = await detailOf({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
    });
    expect(detail.status).toBe(EOnChainHistoryTxStatus.Success);
    expect(detail.gasFee).toBeUndefined();
  });
});

// The STRK20 proving wait re-arms after any transaction this account lands, so
// the writer fires on plain transfers too, and only once the tx really landed.
describe('StarknetVault.fetchAccountHistoryDetail sequencing writer', () => {
  it('stamps the block number of a landed transaction', async () => {
    const { noteAccountTouchedByTx } = await runDetail({
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      block_number: 15_196_592,
    });
    expect(noteAccountTouchedByTx).toHaveBeenCalledWith({
      networkId: NETWORK.id,
      accountId: ACCOUNT_ID,
      blockNumber: 15_196_592,
    });
  });

  it.each([
    [
      'still pre-confirmed',
      {
        execution_status: 'SUCCEEDED' as const,
        finality_status: 'PRE_CONFIRMED' as const,
        block_number: 42,
      },
    ],
    [
      'reverted',
      {
        execution_status: 'REVERTED' as const,
        finality_status: 'ACCEPTED_ON_L2' as const,
        block_number: 42,
      },
    ],
    [
      'accepted without a block number',
      {
        execution_status: 'SUCCEEDED' as const,
        finality_status: 'ACCEPTED_ON_L2' as const,
      },
    ],
  ])('does not stamp a transaction that is %s', async (_name, receipt) => {
    const { noteAccountTouchedByTx } = await runDetail({
      transaction_hash: TXID,
      type: 'INVOKE',
      ...receipt,
    });
    expect(noteAccountTouchedByTx).not.toHaveBeenCalled();
  });
});

describe('StarknetVault.fetchAccountHistoryDetail first send', () => {
  const ADDRESS =
    '0x04ac759e20c1b55199019256c60d7a7710497aad8023d7a9cfe38260faa9d5bf';
  const DEPLOY_TXID = '0x3def';
  const receipts: Record<string, IStarknetReceipt> = {
    [TXID]: {
      transaction_hash: TXID,
      type: 'INVOKE',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      // 0.031051173068834656 STRK, mainnet tx 0x0593f717…a74a
      actual_fee: { amount: '0x6e50e09ca08760', unit: 'FRI' },
      block_number: 16_699_798,
    },
    [DEPLOY_TXID]: {
      transaction_hash: DEPLOY_TXID,
      type: 'DEPLOY_ACCOUNT',
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      // 0.021959945229223264 STRK, its paired deploy 0x043459…2abc
      actual_fee: { amount: '0x4e04742eacc560', unit: 'FRI' },
      block_number: 16_699_798,
    },
  };

  function buildFirstSendVault(extraInfo: Record<string, unknown> | null) {
    const { vault } = buildVault(null);
    const getLocalHistoryTxById = jest.fn(async () => ({
      decodedTx: { extraInfo },
    }));
    Object.assign(vault, {
      backgroundApi: {
        serviceStarknetPrivacy: { noteAccountTouchedByTx: jest.fn() },
        simpleDb: { localHistory: { getLocalHistoryTxById } },
      },
      getClient: async () => ({
        getTransactionReceipt: jest.fn(async (hash: string) => receipts[hash]),
      }),
    });
    return { vault, getLocalHistoryTxById };
  }

  it('adds the paired DEPLOY_ACCOUNT fee to the invoke fee', async () => {
    const { vault, getLocalHistoryTxById } = buildFirstSendVault({
      deployAccountTxId: DEPLOY_TXID,
    });
    const resp = await vault.fetchAccountHistoryDetail({
      accountId: ACCOUNT_ID,
      networkId: NETWORK.id,
      txid: TXID,
      accountAddress: ADDRESS,
    });
    expect(getLocalHistoryTxById).toHaveBeenCalledWith(
      expect.objectContaining({
        historyId: `${NETWORK.id}_${TXID}_${ADDRESS}_`,
      }),
    );
    expect(resp.data.data.data.gasFee).toBe('0.05301111829805792');
  });

  it('keeps the invoke fee alone for a send without a deploy', async () => {
    const { vault } = buildFirstSendVault(null);
    const resp = await vault.fetchAccountHistoryDetail({
      accountId: ACCOUNT_ID,
      networkId: NETWORK.id,
      txid: TXID,
      accountAddress: ADDRESS,
    });
    expect(resp.data.data.data.gasFee).toBe('0.031051173068834656');
  });
});

it('does not label an older ETH fee as STRK or replace an unknown nonce with zero', async () => {
  const detail = await detailOf({
    transaction_hash: TXID,
    type: 'INVOKE',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    actual_fee: { amount: '0xde0b6b3a7640000', unit: 'WEI' },
  });
  expect(detail.gasFee).toBeUndefined();
  expect(detail.nonce).toBeUndefined();
});

it('preserves a real zero FRI fee as known', async () => {
  const detail = await detailOf({
    transaction_hash: TXID,
    type: 'INVOKE',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    actual_fee: { amount: '0x0', unit: 'FRI' },
  });
  expect(detail.gasFee).toBe('0');
});

describe('actual privacy protocol payment', () => {
  const payer = '0x123';
  const collector = '0x456';
  const pool = '0x789';
  const fee = '4500000000000000000';
  const selector = sdkStarknet.buildExecuteCalldata([
    {
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: 'Transfer',
      calldata: [],
    },
  ])[2];
  const historyTx = {
    decodedTx: {
      owner: payer,
      extraInfo: {
        privacy: {
          kind: 'deposit',
          poolAddress: pool,
          protocolFee: '6000000000000000000',
        },
      },
    },
  } as IAccountHistoryTx;
  const event = {
    from_address: STRK_TOKEN_ADDRESS,
    keys: [selector],
    data: [payer, collector, fee, '0x0'],
  };
  const baseReceipt: IStarknetReceipt = {
    transaction_hash: TXID,
    type: 'INVOKE',
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    block_number: 900,
    events: [event],
  };
  async function detail(receipt: IStarknetReceipt, tx = historyTx) {
    const { vault } = buildVault(receipt);
    Object.assign(vault.backgroundApi, {
      simpleDb: { localHistory: { getLocalHistoryTxById: async () => tx } },
    });
    const getPoolFeeCollector = jest.fn(async () => collector);
    const getPoolFeeAmount = jest.fn(async () => fee);
    jest.spyOn(vault, 'getClient').mockResolvedValue({
      getTransactionReceipt: async () => receipt,
      getPoolFeeCollector,
      getPoolFeeAmount,
    } as unknown as Awaited<ReturnType<StarknetVault['getClient']>>);
    const result = await vault.fetchAccountHistoryDetail({
      accountId: ACCOUNT_ID,
      networkId: NETWORK.id,
      txid: TXID,
      accountAddress: payer,
    });
    return {
      paid: result.data.data.data.protocolFeeInNative,
      getPoolFeeCollector,
    };
  }

  it('reads the actual event and historical collector instead of the fee estimated before signing', async () => {
    const result = await detail(baseReceipt);
    expect(result.paid).toBe('4.5');
    expect(result.getPoolFeeCollector).toHaveBeenCalledWith(pool, {
      block_number: 900,
    });
  });
  it('also decodes indexed Transfer events', async () => {
    expect(
      (
        await detail({
          ...baseReceipt,
          events: [
            {
              from_address: STRK_TOKEN_ADDRESS,
              keys: [selector, payer, collector],
              data: [fee, '0x0'],
            },
          ],
        })
      ).paid,
    ).toBe('4.5');
  });
  it('does not charge a reverted transaction a protocol fee', async () => {
    const result = await detail({
      ...baseReceipt,
      execution_status: 'REVERTED',
      events: [],
    });
    expect(result.paid).toBe('0');
    expect(result.getPoolFeeCollector).not.toHaveBeenCalled();
  });
  it.each([
    [[]],
    [[event, event]],
    [[{ ...event, from_address: '0x999' }]],
    [[{ ...event, data: ['0x999', collector, fee, '0x0'] }]],
    [[{ ...event, data: [payer, '0x999', fee, '0x0'] }]],
    [[{ ...event, data: [payer, collector, '1', '0x0'] }]],
    [
      [
        {
          ...event,
          data: [payer, collector, fee, `0x${(2n ** 128n).toString(16)}`],
        },
      ],
    ],
  ])(
    'does not invent a fee from missing or ambiguous evidence: %j',
    async (events) => {
      expect((await detail({ ...baseReceipt, events })).paid).toBeUndefined();
    },
  );
  it('does not attribute an unrelated transfer to the privacy protocol', async () => {
    const result = await detail(baseReceipt, {
      decodedTx: { owner: payer, extraInfo: null },
    } as IAccountHistoryTx);
    expect(result.paid).toBeUndefined();
    expect(result.getPoolFeeCollector).not.toHaveBeenCalled();
  });
});
