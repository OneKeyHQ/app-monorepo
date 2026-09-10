import type { IZcashHistoryItem } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import {
  buildZcashLocalHistoryTx,
  findZcashLocalHistoryItem,
  resolveInternalMoveEndpoints,
  resolvePrivacyChainHistorySide,
} from './localHistory';

function historyItem(txid: string): IZcashHistoryItem {
  return {
    txid,
    minedHeight: 1,
    timestamp: 1,
    valueZat: '1',
    fee: null,
    pending: false,
    expired: false,
    txType: 'received',
    recipient: null,
    poolIds: [4],
    perPoolBalanceDeltaZat: { '4': '1' },
  };
}

describe('resolvePrivacyChainHistorySide', () => {
  it.each([
    [[0], 'public'],
    [[4], 'private'],
    [[4, 99], 'private'],
    [[0, 4, 99], 'mixed'],
    [[], undefined],
  ] as const)('maps pool IDs %j to %s', (poolIds, expected) => {
    expect(resolvePrivacyChainHistorySide({ poolIds: [...poolIds] })).toBe(
      expected,
    );
  });
});

describe('findZcashLocalHistoryItem', () => {
  it('finds shielded detail beyond the first local history page', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce([historyItem('a'), historyItem('b')])
      .mockResolvedValueOnce([historyItem('wanted')]);

    await expect(
      findZcashLocalHistoryItem({
        txid: 'wanted',
        pageSize: 2,
        fetchPage,
      }),
    ).resolves.toEqual(historyItem('wanted'));
    expect(fetchPage).toHaveBeenNthCalledWith(2, { limit: 2, offset: 2 });
  });

  it('stops at the first short page when the tx is unknown locally', async () => {
    const fetchPage = jest.fn().mockResolvedValue([historyItem('a')]);

    await expect(
      findZcashLocalHistoryItem({
        txid: 'missing',
        pageSize: 2,
        fetchPage,
      }),
    ).resolves.toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('buildZcashLocalHistoryTx', () => {
  it('marks sent amount unavailable when fee is unknown and preserves pool deltas', async () => {
    const item = {
      ...historyItem('sent'),
      valueZat: '-61',
      txType: 'sent' as const,
      poolIds: [0, 4, 99],
      perPoolBalanceDeltaZat: { '0': '-100', '4': '39', '99': '0' },
    };
    const tx = await buildZcashLocalHistoryTx({
      item,
      ownAddress: 'own',
      nativeToken: {
        address: '',
        logoURI: '',
        name: 'Zcash',
        symbol: 'ZEC',
      },
      networkId: 'zcash',
      accountId: 'account',
      accountAddress: 'own',
      buildTransferAction: async ({ from, to, transfers }) => ({
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: { from, to, sends: transfers, receives: [] },
      }),
    });

    expect(tx.decodedTx.nativeAmount).toBe('0');
    expect(tx.decodedTx.nativeAmountIsUnknown).toBe(true);
    expect(tx.decodedTx.actions[0].assetTransfer?.sends[0].amount).toBe('0');
    expect(tx.privacyChainHistoryPoolDeltas).toEqual({
      '0': '-0.000001',
      '4': '0.00000039',
      '99': '0',
    });
  });
});

describe('resolveInternalMoveEndpoints', () => {
  const ownAddress = 't1own';

  it('shows a withdraw as money arriving at the transparent address', () => {
    expect(
      resolveInternalMoveEndpoints({
        ownAddress,
        item: { perPoolBalanceDeltaZat: { '4': '-2821200', '0': '2811200' } },
      }),
    ).toEqual({ from: 'Ironwood pool', to: ownAddress });
  });

  it('shows a shield as money leaving the transparent address', () => {
    expect(
      resolveInternalMoveEndpoints({
        ownAddress,
        item: { perPoolBalanceDeltaZat: { '0': '-500000', '4': '490000' } },
      }),
    ).toEqual({ from: ownAddress, to: 'Ironwood pool' });
  });

  it('labels a pool-to-pool move by both pools', () => {
    expect(
      resolveInternalMoveEndpoints({
        ownAddress,
        item: { perPoolBalanceDeltaZat: { '3': '-110000', '4': '100000' } },
      }),
    ).toEqual({ from: 'Orchard pool', to: 'Ironwood pool' });
  });
});

describe('buildZcashLocalHistoryTx counterparties', () => {
  const build = (item: IZcashHistoryItem) =>
    buildZcashLocalHistoryTx({
      item,
      ownAddress: 't1own',
      nativeToken: { address: '', logoURI: '', name: 'Zcash', symbol: 'ZEC' },
      networkId: 'zec--0',
      accountId: 'a',
      accountAddress: 't1own',
      buildTransferAction: async ({ from, to, transfers }) => ({
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from,
          to,
          sends: transfers.filter((x) => x.from === 't1own'),
          receives: transfers.filter((x) => x.from !== 't1own'),
        },
      }),
    });

  it('labels an unknown shielded sender instead of leaving it blank', async () => {
    const tx = await build({ ...historyItem('r'), txType: 'received' });
    const transfer = tx.decodedTx.actions[0].assetTransfer;
    expect(transfer?.receives[0]).toMatchObject({
      from: 'Shielded',
      to: 'Ironwood pool',
      isOwn: true,
    });
    expect(transfer?.sends).toEqual([]);
  });

  it('labels a shielded recipient lost to a rescan', async () => {
    const tx = await build({
      ...historyItem('s'),
      txType: 'sent',
      fee: '10000',
      valueZat: '-5000000',
      recipient: null,
      perPoolBalanceDeltaZat: { '4': '-5010000' },
    });
    const transfer = tx.decodedTx.actions[0].assetTransfer;
    expect(transfer?.sends[0]).toMatchObject({
      from: 'Ironwood pool',
      to: 'Shielded',
      isOwn: true,
    });
  });

  it('keeps the recorded recipient of a send this device made', async () => {
    const tx = await build({
      ...historyItem('s2'),
      txType: 'sent',
      fee: '10000',
      valueZat: '-5000000',
      recipient: 'u1recipient',
      perPoolBalanceDeltaZat: { '4': '-5010000' },
    });
    expect(tx.decodedTx.actions[0].assetTransfer?.sends[0].to).toBe(
      'u1recipient',
    );
  });
});
