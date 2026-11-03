/* eslint-disable import/first */
jest.mock('./accountMeta', () => ({ getZcashStoredUfvk: jest.fn() }));

import { getZcashStoredUfvk } from './accountMeta';
import {
  clearZcashHistoryEnrichment,
  getZcashHistoryEnrichment,
  scheduleZcashHistoryEnrichment,
} from './historyEnrichment';

import type Vault from './Vault';

const txid = 'aa'.repeat(32);
const previousId = 'bb'.repeat(32);
const scope = {
  networkId: 'zec--0',
  accountId: 'history-enrichment',
  txid,
  epoch: 'epoch',
};
const getUfvk = jest.mocked(getZcashStoredUfvk);

async function drain() {
  for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
}

function fixture() {
  const getEpoch = jest.fn().mockResolvedValue('epoch');
  const getState = jest.fn().mockResolvedValue({ intent: 'on' });
  const getRawTransactions = jest.fn().mockResolvedValue({
    [txid]: { rawTx: 'raw-current' },
    [previousId]: { rawTx: 'raw-previous' },
  });
  const inspectTransaction = jest.fn().mockResolvedValue({
    txid,
    inputs: [],
    feeZat: '2000',
    recoveredOutputs: [
      {
        recipient: 'u1-recovered',
        amountZat: '50000',
        memoHex: '00'.repeat(512),
      },
    ],
  });
  const vault = {
    networkId: scope.networkId,
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          getAccountEpoch: getEpoch,
          getZcashPrivacyModeState: getState,
        },
      },
      serviceSend: { getRawTransactions },
    },
    zcashGetApi: async () => ({ inspectTransaction }),
  } as unknown as Vault;
  const schedule = () =>
    scheduleZcashHistoryEnrichment(vault, {
      accountId: scope.accountId,
      txids: [txid],
      epoch: scope.epoch,
    });
  return {
    schedule,
    getEpoch,
    getState,
    getRawTransactions,
    inspectTransaction,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  clearZcashHistoryEnrichment({ networkId: scope.networkId });
  getUfvk.mockReset().mockResolvedValue('private-ufvk');
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('recovers locally and sends only public txids to the backend', async () => {
  const { schedule, inspectTransaction, getRawTransactions } = fixture();
  schedule();
  schedule();
  expect(getZcashHistoryEnrichment(scope)).toBeUndefined();
  await drain();
  expect(inspectTransaction).toHaveBeenCalledTimes(1);
  expect(inspectTransaction).toHaveBeenCalledWith({
    transaction: { txid, rawTx: 'raw-current' },
    ufvk: 'private-ufvk',
  });
  expect(JSON.stringify(getRawTransactions.mock.calls)).not.toContain(
    'private-ufvk',
  );
  expect(getZcashHistoryEnrichment(scope)).toMatchObject({
    feeZat: '2000',
    recoveredOutputs: [{ recipient: 'u1-recovered' }],
  });
});

it('fills a missing fee from authenticated previous transactions', async () => {
  const { schedule, inspectTransaction, getRawTransactions } = fixture();
  inspectTransaction.mockResolvedValueOnce({
    txid,
    inputs: [{ txid: previousId, vout: 0 }],
    feeZat: null,
    recoveredOutputs: [],
  });
  schedule();
  await drain();
  expect(getRawTransactions.mock.calls[1][0].txids).toEqual([previousId]);
  expect(inspectTransaction.mock.calls[1][0].previousTransactions).toEqual([
    { txid: previousId, rawTx: 'raw-previous' },
  ]);
  expect(getZcashHistoryEnrichment(scope)?.feeZat).toBe('2000');
});

it('does not attach a viewing key while private data is disabled', async () => {
  const { schedule, getState, inspectTransaction } = fixture();
  getState.mockResolvedValue({ intent: 'off' });
  schedule();
  await drain();
  expect(getUfvk).not.toHaveBeenCalled();
  expect(inspectTransaction.mock.calls[0][0].ufvk).toBeUndefined();
});

it.each(['epoch changed', 'lifecycle cleared'])(
  'discards a late decrypted result after %s',
  async (change) => {
    const { schedule, getEpoch, getRawTransactions } = fixture();
    let resolveRaw: (value: object) => void = () => undefined;
    getRawTransactions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRaw = resolve;
        }),
    );
    schedule();
    await drain();
    if (change === 'epoch changed') getEpoch.mockResolvedValue('new-epoch');
    else
      clearZcashHistoryEnrichment({
        networkId: scope.networkId,
        accountIds: [scope.accountId],
      });
    resolveRaw({ [txid]: { rawTx: 'raw-current' } });
    await drain();
    expect(getZcashHistoryEnrichment(scope)).toBeUndefined();
  },
);

it('leaves backend facts untouched when local inspection fails', async () => {
  const { schedule, inspectTransaction } = fixture();
  inspectTransaction.mockRejectedValue(new Error('raw txid mismatch'));
  schedule();
  await drain();
  expect(getZcashHistoryEnrichment(scope)).toBeUndefined();
});
