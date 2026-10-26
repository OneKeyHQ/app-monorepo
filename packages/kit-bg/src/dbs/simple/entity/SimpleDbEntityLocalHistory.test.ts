import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { TravelModeManager } from '@onekeyhq/shared/src/travelMode/TravelModeManager';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  SimpleDbEntityLocalHistory,
  canPersistLocalHistoryTx,
} from './SimpleDbEntityLocalHistory';

function tx(
  side?: IAccountHistoryTx['privacyChainHistorySide'],
  poolIds?: number[],
): IAccountHistoryTx {
  return {
    id: 'history-id',
    decodedTx: { networkId: getNetworkIdsMap().zec },
    privacyChainHistorySide: side,
    privacyChainHistoryPoolIds: poolIds,
  } as IAccountHistoryTx;
}

describe('local wallet history persistence boundary', () => {
  it('keeps public-side rows and rows without a side marker', () => {
    for (const row of [tx('public', [0]), tx()]) {
      expect(
        canPersistLocalHistoryTx({
          networkId: getNetworkIdsMap().zec,
          tx: row,
        }),
      ).toBe(true);
    }
  });

  it('never persists private, mixed, or unmarked runtime rows', () => {
    for (const row of [
      tx('private', [4]),
      tx('mixed', [0, 4]),
      tx(undefined, []),
      tx(undefined, [0]),
    ]) {
      expect(
        canPersistLocalHistoryTx({
          networkId: getNetworkIdsMap().zec,
          tx: row,
        }),
      ).toBe(false);
    }
  });

  it('does not change persistence rules for other networks', () => {
    expect(
      canPersistLocalHistoryTx({
        networkId: getNetworkIdsMap().btc,
        tx: tx(),
      }),
    ).toBe(true);
  });
});

describe('pending history timestamps', () => {
  it('preserves submission time across refreshes and restores an older journal time', async () => {
    let stored: unknown = null;
    const entity = new SimpleDbEntityLocalHistory();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => stored,
      setItem: async (_key: string, value: unknown) => {
        stored = value;
      },
    };
    const params = {
      networkId: getNetworkIdsMap().zec,
      accountAddress: 't1-test',
    };
    const pending = {
      ...tx('public', [0]),
      decodedTx: {
        ...tx().decodedTx,
        status: EDecodedTxStatus.Pending,
        createdAt: 1000,
        updatedAt: 1000,
      },
    };
    await entity.saveLocalHistoryTxs({ ...params, pendingTxs: [pending] });
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [
        {
          ...pending,
          decodedTx: { ...pending.decodedTx, createdAt: 2000, updatedAt: 2000 },
        },
      ],
    });
    expect(
      (await entity.getAccountLocalHistoryPendingTxs(params))[0].decodedTx,
    ).toMatchObject({ createdAt: 1000, updatedAt: 1000 });
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [
        {
          ...pending,
          decodedTx: { ...pending.decodedTx, createdAt: 500, updatedAt: 500 },
        },
      ],
    });
    expect(
      (await entity.getAccountLocalHistoryPendingTxs(params))[0].decodedTx,
    ).toMatchObject({ createdAt: 500, updatedAt: 500 });
  });
});

describe('durable pending history expiry', () => {
  const params = {
    networkId: getNetworkIdsMap().zec,
    accountAddress: 't1-test',
  };
  const pending: IAccountHistoryTx = {
    ...tx('public', [0]),
    decodedTx: {
      ...tx().decodedTx,
      txid: 'aa'.repeat(32),
      status: EDecodedTxStatus.Pending,
      createdAt: 1,
      updatedAt: 1,
    },
  };
  async function fixture() {
    let saved: unknown;
    const entity = new SimpleDbEntityLocalHistory();
    const storage = {
      getItem: async () => saved,
      setItem: jest.fn(async (_key: string, value: unknown) => {
        saved = value;
      }),
      removeItem: async () => {
        saved = undefined;
      },
    };
    Reflect.set(entity, 'appStorage', storage);
    await entity.saveLocalHistoryTxs({ ...params, pendingTxs: [pending] });
    const drop = (isCurrent = async () => true) =>
      entity.dropPendingLocalHistoryTx({
        ...params,
        txid: pending.decodedTx.txid,
        addressGate: {},
        isCurrent,
      });
    return { entity, storage, drop };
  }
  afterEach(() => jest.restoreAllMocks());

  it('changes only the fresh target row and preserves another newly submitted send', async () => {
    const { entity, drop } = await fixture();
    const other = {
      ...pending,
      id: 'another',
      decodedTx: { ...pending.decodedTx, txid: 'bb'.repeat(32) },
    };
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [pending, other],
    });
    expect(await drop()).toBe(true);
    expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual([
      other,
    ]);
    expect(
      (await entity.getAccountLocalHistoryConfirmedTxs(params))[0].decodedTx,
    ).toMatchObject({
      status: EDecodedTxStatus.Dropped,
      broadcastOutcomeUnknown: false,
    });
    // A durable Dropped row lets a subsequent poll retry journal settlement.
    expect(await drop()).toBe(true);
  });

  it('does not recreate history after a cache clear', async () => {
    const { entity, drop } = await fixture();
    await entity.clearRawData();
    expect(await drop()).toBe(false);
    expect(await entity.getRawData()).toBeFalsy();
  });

  it.each([EDecodedTxStatus.Pending, EDecodedTxStatus.Confirmed])(
    'does not run journal-only cleanup when a %s history row exists',
    async (status) => {
      const { entity } = await fixture();
      if (status === EDecodedTxStatus.Confirmed)
        await entity.saveLocalHistoryTxs({
          ...params,
          confirmedTxs: [
            { ...pending, decodedTx: { ...pending.decodedTx, status } },
          ],
        });
      const operation = jest.fn(async () => undefined);
      await entity.runIfHistoryTxAbsent({
        ...params,
        txid: pending.decodedTx.txid.toUpperCase(),
        operation,
      });
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it('holds the history mutex through journal-only cleanup', async () => {
    const { entity } = await fixture();
    await entity.clearAccountLocalHistory(params);
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cleanup = entity.runIfHistoryTxAbsent({
      ...params,
      txid: pending.decodedTx.txid,
      operation: async () => {
        started();
        await gate;
        expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual(
          [],
        );
      },
    });
    await entered;
    const writer = entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [pending],
    });
    release();
    await Promise.all([cleanup, writer]);
    expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual([
      pending,
    ]);
  });

  it.each(['save', 'batch', 'status'])(
    'prevents a concurrent stale %s writer from restoring Pending',
    async (writer) => {
      const { entity, storage, drop } = await fixture();
      const btc = {
        networkId: getNetworkIdsMap().btc,
        accountAddress: 'btc-other',
      };
      await entity.saveLocalHistoryTxs({
        ...btc,
        confirmedTxs: [
          {
            ...pending,
            decodedTx: {
              ...pending.decodedTx,
              networkId: btc.networkId,
              status: EDecodedTxStatus.Confirmed,
            },
          },
        ],
      });
      let started!: () => void;
      let release!: () => void;
      const writeStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      const writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const originalWrite = storage.setItem.getMockImplementation()!;
      storage.setItem.mockImplementationOnce(async (key, value) => {
        started();
        await writeGate;
        await originalWrite(key, value);
      });
      const dropping = drop();
      await writeStarted;
      const other = {
        ...pending,
        id: 'another',
        decodedTx: { ...pending.decodedTx, txid: 'bb'.repeat(32) },
      };
      const staleWrite = (() => {
        if (writer === 'save')
          return entity.saveLocalHistoryTxs({
            ...params,
            pendingTxs: [pending, other],
          });
        if (writer === 'batch')
          return entity.batchUpdateLocalHistoryTxs([
            { ...params, pendingTxs: [pending, other] },
          ]);
        return entity.updateLocalHistoryConfirmedTxStatus({
          ...btc,
          txid: pending.decodedTx.txid,
          status: EDecodedTxStatus.Failed,
        });
      })();
      release();
      await Promise.all([dropping, staleWrite]);
      expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual(
        writer === 'status' ? [] : [other],
      );
      expect(
        (await entity.getAccountLocalHistoryConfirmedTxs(params))[0].decodedTx
          .status,
      ).toBe(EDecodedTxStatus.Dropped);
    },
  );

  it('replaces Dropped with a backend row already in a block even if its status is Pending', async () => {
    const { entity, drop } = await fixture();
    await drop();
    const mined = {
      ...pending,
      decodedTx: { ...pending.decodedTx, block: 90 },
    };
    await entity.saveLocalHistoryTxs({ ...params, pendingTxs: [mined] });
    expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual([
      mined,
    ]);
    expect(await entity.getAccountLocalHistoryConfirmedTxs(params)).toEqual([]);
  });

  it('allows real confirmation to replace Dropped and explicit removal to delete it', async () => {
    const { entity, drop } = await fixture();
    await drop();
    const confirmed = {
      ...pending,
      decodedTx: {
        ...pending.decodedTx,
        status: EDecodedTxStatus.Confirmed,
        block: 90,
      },
    };
    await entity.saveLocalHistoryTxs({ ...params, confirmedTxs: [confirmed] });
    expect(
      (await entity.getAccountLocalHistoryConfirmedTxs(params))[0].decodedTx
        .status,
    ).toBe(EDecodedTxStatus.Confirmed);
    await entity.updateLocalHistoryConfirmedTxs({
      ...params,
      confirmedTxsToRemove: [confirmed],
    });
    expect(await entity.getAccountLocalHistoryConfirmedTxs(params)).toEqual([]);
    // Explicit deletion also works for a Dropped row itself.
    await entity.saveLocalHistoryTxs({ ...params, pendingTxs: [pending] });
    await drop();
    await entity.updateLocalHistoryConfirmedTxs({
      ...params,
      confirmedTxsToRemove: [pending],
    });
    expect(await entity.getAccountLocalHistoryConfirmedTxs(params)).toEqual([]);
  });

  it('preserves the existing behavior of unmarked BTC pending rows', async () => {
    const { entity } = await fixture();
    const btc = {
      networkId: getNetworkIdsMap().btc,
      accountAddress: 'btc-test',
    };
    const row: IAccountHistoryTx = {
      ...pending,
      privacyChainHistorySide: undefined,
      privacyChainHistoryPoolIds: undefined,
      decodedTx: { ...pending.decodedTx, networkId: btc.networkId },
    };
    await entity.saveLocalHistoryTxs({
      ...btc,
      confirmedTxs: [
        {
          ...row,
          decodedTx: {
            ...row.decodedTx,
            status: EDecodedTxStatus.Dropped,
            broadcastOutcomeUnknown: false,
          },
        },
      ],
    });
    await entity.saveLocalHistoryTxs({ ...btc, pendingTxs: [row] });
    expect(await entity.getAccountLocalHistoryPendingTxs(btc)).toEqual([row]);
  });

  it.each([
    EDecodedTxStatus.Confirmed,
    EDecodedTxStatus.Failed,
    EDecodedTxStatus.Removed,
  ])('preserves a concurrent terminal status %s', async (status) => {
    const { entity, drop } = await fixture();
    await entity.saveLocalHistoryTxs({
      ...params,
      confirmedTxs: [
        { ...pending, decodedTx: { ...pending.decodedTx, status } },
      ],
    });
    expect(await drop()).toBe(false);
    expect(
      (await entity.getAccountLocalHistoryConfirmedTxs(params))[0].decodedTx
        .status,
    ).toBe(status);
  });

  it('does not drop a row with a mined block even if its status is still pending', async () => {
    const { entity, drop } = await fixture();
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [
        { ...pending, decodedTx: { ...pending.decodedTx, block: 90 } },
      ],
    });
    expect(await drop()).toBe(false);
  });

  it('rolls back when ownership changes during persistence', async () => {
    const { entity, drop } = await fixture();
    const isCurrent = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    expect(await drop(isCurrent)).toBe(false);
    expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual([
      pending,
    ]);
    expect(await entity.getAccountLocalHistoryConfirmedTxs(params)).toEqual([]);
  });

  it('reports a storage failure and keeps the pending row', async () => {
    const { entity, storage, drop } = await fixture();
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(drop()).rejects.toThrow('storage unavailable');
    expect(await entity.getAccountLocalHistoryPendingTxs(params)).toEqual([
      pending,
    ]);
  });

  it('does not claim a commit when travel mode blocks persistence', async () => {
    const { storage, drop } = await fixture();
    const manager = new TravelModeManager(
      {
        getItem: async () =>
          JSON.stringify({
            enabled: true,
            verifyString: '|VS|verifier',
            version: 1,
          }),
        removeItem: async () => undefined,
        setItem: async () => undefined,
      },
      true,
    );
    await manager.ready;
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironment')
      .mockImplementation(() => manager.getRuntimeEnvironment());
    storage.setItem.mockClear();
    expect(await drop()).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
