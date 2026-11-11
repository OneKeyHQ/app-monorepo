/*
yarn jest packages/kit-bg/src/vaults/impls/btc/Vault.signedTxConflict.test.ts

OK-67090: a chunk of a split bulk send is rebuilt on fresh UTXOs before it is
signed. When its broadcast fails without a verdict, a retry may sign a new tx
only if that tx spends an output the earlier payload spends as well, because
two such txs cannot both confirm.
*/
import type { IBtcInput } from '@onekeyhq/core/src/chains/btc/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import { ESignedTxBroadcastStatus } from '../../types';

import VaultBtc from './Vault';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const buildVault = () => Object.create(VaultBtc.prototype) as VaultBtc;

const input = (txid: string, vout: number) => ({ txid, vout }) as IBtcInput;

const unsignedTxOf = (inputs: IBtcInput[] | undefined) =>
  ({ encodedTx: inputs ? { inputs } : null }) as unknown as IUnsignedTxPro;

const signedTxOf = (inputs: IBtcInput[] | undefined) =>
  ({
    txid: 'txid-1',
    rawTx: '00',
    encodedTx: inputs ? { inputs } : null,
  }) as unknown as ISignedTxPro;

describe('VaultBtc.isUnsignedTxConflictingWithSignedTx', () => {
  const check = (
    inputs: IBtcInput[] | undefined,
    signedInputs: IBtcInput[] | undefined,
  ) =>
    buildVault().isUnsignedTxConflictingWithSignedTx({
      unsignedTx: unsignedTxOf(inputs),
      signedTx: signedTxOf(signedInputs),
    });

  it('holds when both txs spend the same output', async () => {
    await expect(
      check([input('aa', 0), input('bb', 1)], [input('bb', 1), input('cc', 0)]),
    ).resolves.toBe(true);
  });

  it('does not hold for a tx re-selected on other outputs', async () => {
    // the earlier payload reached the mempool, so fresh coin selection sees
    // its inputs as spent and picks its change output instead
    await expect(
      check([input('change-of-earlier', 2)], [input('aa', 0), input('bb', 1)]),
    ).resolves.toBe(false);
  });

  it('tells outputs of one tx apart by their index', async () => {
    await expect(check([input('aa', 1)], [input('aa', 0)])).resolves.toBe(
      false,
    );
  });

  it('does not hold when the inputs of either tx are not on record', async () => {
    await expect(check([input('aa', 0)], undefined)).resolves.toBe(false);
    await expect(check(undefined, [input('aa', 0)])).resolves.toBe(false);
  });
});

describe('VaultBtc.checkSignedTxBroadcastStatus', () => {
  const buildVaultWithHistory = (txDetails: unknown) => {
    const fetchHistoryTxDetails = jest.fn(async () => txDetails);
    const vault = buildVault();
    Object.assign(vault, {
      accountId: 'hd-1--m/84h/0h/0h',
      networkId: 'btc--0',
      backgroundApi: { serviceHistory: { fetchHistoryTxDetails } },
    });
    return { vault, fetchHistoryTxDetails };
  };
  const check = (vault: VaultBtc) =>
    vault.checkSignedTxBroadcastStatus({
      signedTx: signedTxOf([input('aa', 0)]),
      attemptedAt: 0,
    });

  it('reports a tx the chain can show as broadcast', async () => {
    const { vault, fetchHistoryTxDetails } = buildVaultWithHistory({
      data: { tx: 'txid-1', status: EOnChainHistoryTxStatus.Success },
    });

    await expect(check(vault)).resolves.toBe(
      ESignedTxBroadcastStatus.Broadcast,
    );
    expect(fetchHistoryTxDetails).toHaveBeenCalledWith({
      accountId: 'hd-1--m/84h/0h/0h',
      networkId: 'btc--0',
      txid: 'txid-1',
    });
  });

  it('gives no verdict for a tx the lookup cannot find', async () => {
    const { vault } = buildVaultWithHistory(null);
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });

  it('gives no verdict for a tx the lookup only reports as pending', async () => {
    const { vault } = buildVaultWithHistory({
      data: { tx: 'txid-1', status: EOnChainHistoryTxStatus.Pending },
    });
    await expect(check(vault)).resolves.toBe(ESignedTxBroadcastStatus.Unknown);
  });
});
