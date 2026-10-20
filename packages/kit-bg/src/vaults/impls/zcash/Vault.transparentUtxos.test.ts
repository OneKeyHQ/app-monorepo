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
  inUse = [],
}: {
  utxos?: (typeof utxo)[];
  parsed?: IZcashParsedTransparentTransaction[];
  raw?: Record<string, string>;
  inUse?: string[];
} = {}) {
  const fetchAccountDetails = jest
    .spyOn(VaultBtc.prototype, 'fetchAccountDetails')
    .mockResolvedValue({
      data: { data: { address: utxo.address, allUtxoList: utxos } },
    } as Awaited<ReturnType<VaultBtc['fetchAccountDetails']>>);
  const getRawTransactions = jest
    .fn()
    .mockResolvedValue(
      Object.fromEntries(
        Object.entries(raw).map(([id, rawTx]) => [id, { rawTx }]),
      ),
    );
  const parseTransparentTransactions = jest.fn().mockResolvedValue(parsed);
  const listTransparentOutpointsInUse = jest.fn(async () => new Set(inUse));
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    backgroundApi: {
      simpleDb: {
        zcash: { listTransparentOutpointsInUse },
      },
      serviceSend: { getRawTransactions },
    },
    getAccount: async () => ({
      id: 'public-fixture',
      address: utxo.address,
      pathIndex: 0,
    }),
    zcashGetApi: async () => ({ parseTransparentTransactions }),
  });
  return {
    vault,
    getRawTransactions,
    parseTransparentTransactions,
    fetchAccountDetails,
    listTransparentOutpointsInUse,
  };
}

afterEach(() => jest.restoreAllMocks());

it('uses the already fetched next-block height to exclude only live signing reservations', async () => {
  const { vault, listTransparentOutpointsInUse } = createVault();
  await vault['zcashFetchFreshTransparentUtxos']();
  expect(listTransparentOutpointsInUse).toHaveBeenCalledWith({
    accountId: 'public-fixture',
    currentHeight: utxo.height + utxo.confirmations,
  });
});

it('completes ordinary OneKey UTXOs from the backend raw transactions', async () => {
  const { vault, getRawTransactions, parseTransparentTransactions } =
    createVault();
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(getRawTransactions).toHaveBeenCalledWith({
    networkId: 'zec--0',
    txids: [txid],
    retries: undefined,
  });
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
});

it('fetches duplicate transactions only once', async () => {
  const { vault, getRawTransactions } = createVault({ utxos: [utxo, utxo] });
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toHaveLength(
    1,
  );
  expect(getRawTransactions).toHaveBeenCalledWith(
    expect.objectContaining({ txids: [txid] }),
  );
});

it('keeps previously received change at the internal address spendable', async () => {
  const legacyPath = "m/44'/133'/0'/1/0";
  const { vault } = createVault({ utxos: [{ ...utxo, path: legacyPath }] });
  const result = await vault.zcashFetchFreshTransparentUtxos();
  expect(result.utxos).toEqual([
    expect.objectContaining({
      derivationPath: legacyPath,
      valueZat: utxo.value,
    }),
  ]);
});

// A pending or signing send still spends it until it settles or expires.
it('skips an outpoint another send is spending', async () => {
  const { vault } = createVault({ inUse: [`${txid.toUpperCase()}:0`] });
  const result = await vault['zcashFetchFreshTransparentUtxos']();
  expect(result.utxos).toEqual([]);
  expect(result.targetHeight).toBe(utxo.height + utxo.confirmations);
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
  const { vault, getRawTransactions } = createVault({
    utxos: [{ ...utxo, confirmations: 0 }],
  });
  expect((await vault['zcashFetchFreshTransparentUtxos']()).utxos).toEqual([]);
  expect(getRawTransactions).not.toHaveBeenCalled();
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
    getRawTransactions,
    parseTransparentTransactions,
    fetchAccountDetails,
  } = createVault();
  await vault['zcashFetchFreshTransparentUtxos']();
  await vault['zcashFetchFreshTransparentUtxos']();
  expect(getRawTransactions).toHaveBeenCalledTimes(1);
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
});
