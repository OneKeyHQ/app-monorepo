/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IZcashParsedTransparentTransaction } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

import VaultBtc from '../btc/Vault';

import Vault from './Vault';

const txid = '70'.repeat(32);
const scriptPubKey = `76a914${'95'.repeat(20)}88ac`;
const utxo = {
  txid,
  vout: 0,
  value: '100000',
  height: 3_476_066,
  confirmations: 14_074,
  address: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
  path: "m/44'/133'/0'/0/0",
};

function createVault({
  utxos = [utxo],
  parsed = [
    {
      txid,
      isCoinbase: false,
      outputs: [{ valueZat: utxo.value, scriptPubKey }],
    },
  ],
  raw = { [txid]: 'raw-transaction' },
}: {
  utxos?: (typeof utxo)[];
  parsed?: IZcashParsedTransparentTransaction[];
  raw?: Record<string, string>;
} = {}) {
  const fetchAccountDetails = jest
    .spyOn(VaultBtc.prototype, 'fetchAccountDetails')
    .mockResolvedValue({
      data: { data: { address: utxo.address, allUtxoList: utxos } },
    } as Awaited<ReturnType<VaultBtc['fetchAccountDetails']>>);
  const collectTxsByApi = jest.fn().mockResolvedValue(raw);
  const parseTransparentTransactions = jest.fn().mockResolvedValue(parsed);
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    getAccount: async () => ({
      id: 'public-fixture',
      address: utxo.address,
      pathIndex: 0,
    }),
    collectTxsByApi,
    zcashGetApi: async () => ({ parseTransparentTransactions }),
  });
  return {
    vault,
    collectTxsByApi,
    parseTransparentTransactions,
    fetchAccountDetails,
  };
}

afterEach(() => jest.restoreAllMocks());

it('completes ordinary OneKey UTXOs using the BTC raw transaction collector', async () => {
  const { vault, collectTxsByApi, parseTransparentTransactions } =
    createVault();
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(collectTxsByApi).toHaveBeenCalledWith([txid]);
  expect(parseTransparentTransactions).toHaveBeenCalledWith({
    transactions: [{ txid, rawTx: 'raw-transaction' }],
  });
  expect(result.utxos).toEqual([
    {
      txid,
      vout: 0,
      valueZat: utxo.value,
      scriptPubKey,
      isCoinbase: false,
      confirmations: utxo.confirmations,
      derivationPath: utxo.path,
    },
  ]);
  expect(result.runtimeUtxos).toEqual([
    {
      txid,
      vout: 0,
      valueZat: utxo.value,
      scriptPubKey,
      height: utxo.height,
    },
  ]);
});

it('fetches duplicate transactions only once', async () => {
  const { vault, collectTxsByApi } = createVault({ utxos: [utxo, utxo] });
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toHaveLength(
    1,
  );
  expect(collectTxsByApi).toHaveBeenCalledWith([txid]);
});

it('preserves coinbase exclusion and reports its balance', async () => {
  const { vault } = createVault({
    parsed: [
      {
        txid,
        isCoinbase: true,
        outputs: [{ valueZat: utxo.value, scriptPubKey }],
      },
    ],
  });
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(result.utxos).toEqual([]);
  expect(result.runtimeUtxos).toEqual([]);
  expect(result.coinbaseZat).toBe(utxo.value);
});

it.each(['missing', 'amount', 'output'])(
  'rejects %s previous transaction data',
  async (kind) => {
    const { vault } = createVault({
      raw: kind === 'missing' ? {} : { [txid]: 'raw-transaction' },
      parsed: [
        {
          txid,
          isCoinbase: false,
          outputs: kind === 'output' ? [] : [{ valueZat: '1', scriptPubKey }],
        },
      ],
    });
    await expect(
      vault['zcashFetchFreshTransparentUtxos'](),
    ).rejects.toBeDefined();
  },
);

it('does not replace a failed SDK parse with server metadata', async () => {
  const { vault, parseTransparentTransactions } = createVault();
  parseTransparentTransactions.mockRejectedValue(new Error('txid mismatch'));
  await expect(vault['zcashFetchFreshTransparentUtxos']()).rejects.toThrow(
    'txid mismatch',
  );
});

it('does not fetch previous transactions for an empty or unconfirmed wallet', async () => {
  const { vault, collectTxsByApi } = createVault({
    utxos: [{ ...utxo, confirmations: 0 }],
  });
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toEqual([]);
  expect(collectTxsByApi).not.toHaveBeenCalled();
});

it('keeps confirmation, derivation path, and input script restrictions', async () => {
  for (const invalid of [
    { ...utxo, confirmations: 1 },
    { ...utxo, path: "m/44'/0'/0'/0/0" },
    { ...utxo, path: '' },
  ]) {
    const { vault } = createVault({ utxos: [invalid] });
    expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toEqual(
      [],
    );
    jest.restoreAllMocks();
  }
  const { vault } = createVault({
    parsed: [
      {
        txid,
        isCoinbase: false,
        outputs: [{ valueZat: utxo.value, scriptPubKey: '6a' }],
      },
    ],
  });
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toEqual([]);
});

it('normalizes equal integer amounts before passing them to the SDK', async () => {
  const { vault } = createVault({ utxos: [{ ...utxo, value: '000100000' }] });
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(result.utxos[0].valueZat).toBe('100000');
  expect(result.runtimeUtxos[0].valueZat).toBe('100000');
});

it.each(['', 'NaN', 'Infinity', '-1', '100000.0', '1e5', ' 100000', '0x186a0'])(
  'rejects malformed indexer amount %s',
  async (value) => {
    const { vault } = createVault({ utxos: [{ ...utxo, value }] });
    await expect(vault['zcashFetchFreshTransparentUtxos']()).rejects.toThrow(
      'Zcash UTXO does not match its previous transaction',
    );
  },
);

it('reuses verified outputs while refreshing UTXO availability', async () => {
  const {
    vault,
    collectTxsByApi,
    parseTransparentTransactions,
    fetchAccountDetails,
  } = createVault();
  await vault['zcashFetchFreshTransparentUtxos']();
  await vault['zcashFetchFreshTransparentUtxos']();
  expect(collectTxsByApi).toHaveBeenCalledTimes(1);
  expect(parseTransparentTransactions).toHaveBeenCalledTimes(1);
  fetchAccountDetails.mockResolvedValue({
    data: { data: { address: utxo.address, allUtxoList: [] } },
  } as Awaited<ReturnType<VaultBtc['fetchAccountDetails']>>);
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toEqual([]);
  expect(fetchAccountDetails).toHaveBeenCalledTimes(3);
});

it('does not select a zero-value output', async () => {
  const { vault } = createVault({
    utxos: [{ ...utxo, value: '0' }],
    parsed: [
      { txid, isCoinbase: false, outputs: [{ valueZat: '0', scriptPubKey }] },
    ],
  });
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(result.utxos).toEqual([]);
  expect(result.runtimeUtxos).toEqual([]);
});
