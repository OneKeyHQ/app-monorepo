import { BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositLocalSession } from '@onekeyhq/shared/types/exchange';

import {
  type ISimpleDbBinanceDeposit,
  SimpleDbEntityBinanceDeposit,
} from './SimpleDbEntityBinanceDeposit';

function setupEntity(initial?: ISimpleDbBinanceDeposit | null) {
  const entity = new SimpleDbEntityBinanceDeposit();
  let store: ISimpleDbBinanceDeposit | null | undefined = initial;
  jest.spyOn(entity, 'getRawData').mockImplementation(async () => store);
  jest.spyOn(entity, 'setRawData').mockImplementation(async (builder) => {
    store = typeof builder === 'function' ? await builder(store) : builder;
    return store;
  });
  return { entity, getStore: () => store };
}

function buildSession(
  localId: string,
  overrides: Partial<IBinanceDepositLocalSession> = {},
): IBinanceDepositLocalSession {
  return {
    localId,
    accountId: 'account-1',
    senderAddress: '0x1111111111111111111111111111111111111111',
    networkId: 'evm--56',
    cryptoCurrency: 'USDT',
    status: EBinanceDepositSessionStatus.EXPIRED,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function toStore(sessions: IBinanceDepositLocalSession[]) {
  return {
    sessions: Object.fromEntries(
      sessions.map((session) => [session.localId, session]),
    ),
  };
}

describe('SimpleDbEntityBinanceDeposit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads as empty when nothing was stored yet', async () => {
    const { entity } = setupEntity(null);

    await expect(entity.getSessionList()).resolves.toEqual({
      sessions: [],
      activeLocalId: undefined,
    });
    await expect(entity.getSession('missing')).resolves.toBeUndefined();
  });

  test('adds a session and makes it the active one', async () => {
    const { entity, getStore } = setupEntity(null);
    const session = buildSession('new', { status: 'LOCAL_PENDING_CREATE' });

    await expect(entity.addSession(session)).resolves.toEqual({
      added: true,
      evicted: [],
    });
    expect(getStore()).toEqual({
      sessions: { new: session },
      activeLocalId: 'new',
    });
  });

  test('refuses a second session while one is in progress', async () => {
    const inProgress = buildSession('first', {
      status: EBinanceDepositSessionStatus.INIT,
    });
    const { entity, getStore } = setupEntity({
      ...toStore([inProgress]),
      activeLocalId: 'first',
    });

    await expect(
      entity.addSession(
        buildSession('second', { status: 'LOCAL_PENDING_CREATE' }),
      ),
    ).resolves.toEqual({
      added: false,
      inProgressLocalId: 'first',
      evicted: [],
    });
    expect(Object.keys(getStore()?.sessions ?? {})).toEqual(['first']);
    expect(getStore()?.activeLocalId).toBe('first');
  });

  test('does not count a locally closed session as in progress', async () => {
    const abandoned = buildSession('first', {
      status: EBinanceDepositSessionStatus.INIT,
      localClosedReason: 'abandoned',
    });
    const { entity } = setupEntity(toStore([abandoned]));

    const result = await entity.addSession(
      buildSession('second', { status: 'LOCAL_PENDING_CREATE' }),
    );

    expect(result.added).toBe(true);
  });

  test('drops the oldest closed sessions once over the cap', async () => {
    const closed = Array.from(
      { length: BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS },
      (_, index) =>
        buildSession(`closed-${index}`, {
          // Stored out of order on purpose: eviction goes by updatedAt.
          updatedAt: 100 - index,
        }),
    );
    const { entity, getStore } = setupEntity(toStore(closed));

    const result = await entity.addSession(
      buildSession('new', { status: 'LOCAL_PENDING_CREATE', updatedAt: 500 }),
    );

    const oldest = closed[closed.length - 1];
    expect(result.added).toBe(true);
    expect(result.evicted).toEqual([oldest]);
    const stored = getStore()?.sessions ?? {};
    expect(Object.keys(stored)).toHaveLength(
      BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS,
    );
    expect(stored[oldest.localId]).toBeUndefined();
    expect(stored.new).toBeDefined();
  });

  test('never drops an authorized session that may still have to report', async () => {
    const unreported = Array.from(
      { length: BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS - 1 },
      (_, index) =>
        buildSession(`authorized-${index}`, {
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          updatedAt: index,
        }),
    );
    const pendingReport = buildSession('pending-report', {
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      updatedAt: 0,
      report: {
        txHash: '0xabc',
        senderAddress: '0xdef',
        status: 'PENDING',
        attempts: 1,
        updatedAt: 0,
      },
    });
    const { entity, getStore } = setupEntity(
      toStore([...unreported, pendingReport]),
    );

    const result = await entity.addSession(
      buildSession('new', { status: 'LOCAL_PENDING_CREATE' }),
    );

    // Nothing is droppable, so the store grows past the cap instead of
    // losing a session key that a report still needs.
    expect(result).toEqual({ added: true, evicted: [] });
    expect(Object.keys(getStore()?.sessions ?? {})).toHaveLength(
      BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS + 1,
    );
  });

  test('treats a confirmed or failed report as droppable', async () => {
    const report = {
      txHash: '0xabc',
      senderAddress: '0xdef',
      attempts: 1,
      updatedAt: 0,
    };
    const keep = Array.from(
      { length: BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS - 1 },
      (_, index) =>
        buildSession(`authorized-${index}`, {
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          updatedAt: index,
        }),
    );
    const confirmed = buildSession('confirmed', {
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      updatedAt: 50,
      report: { ...report, status: 'CONFIRMED' },
    });
    const failed = buildSession('failed', {
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      updatedAt: 60,
      report: { ...report, status: 'FAILED' },
    });
    const { entity } = setupEntity(toStore([...keep, confirmed, failed]));

    const result = await entity.addSession(
      buildSession('new', { status: 'LOCAL_PENDING_CREATE' }),
    );

    expect(result.evicted.map((item) => item.localId)).toEqual([
      'confirmed',
      'failed',
    ]);
  });

  test('updates one session in place and stamps updatedAt', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(9000);
    const session = buildSession('one', {
      status: EBinanceDepositSessionStatus.INIT,
    });
    const other = buildSession('other');
    const { entity, getStore } = setupEntity(toStore([session, other]));

    const stored = await entity.updateSession('one', (current) => ({
      ...current,
      // An updater cannot move the record to another id.
      localId: 'hijacked',
      linkOpenedAt: 1234,
    }));

    expect(stored).toEqual({
      ...session,
      linkOpenedAt: 1234,
      updatedAt: 9000,
    });
    expect(getStore()?.sessions).toEqual({ one: stored, other });
  });

  test('leaves the record untouched when the updater declines', async () => {
    const session = buildSession('one');
    const { entity, getStore } = setupEntity(toStore([session]));

    await expect(entity.updateSession('one', () => undefined)).resolves.toEqual(
      session,
    );
    expect(getStore()?.sessions.one).toEqual(session);
  });

  test('does not call the updater for an unknown session', async () => {
    const { entity } = setupEntity(toStore([buildSession('one')]));
    const updater = jest.fn();

    await expect(
      entity.updateSession('missing', updater),
    ).resolves.toBeUndefined();
    expect(updater).not.toHaveBeenCalled();
  });

  test('ignores malformed stored data instead of throwing', async () => {
    const { entity } = setupEntity({
      sessions: 'corrupt',
      activeLocalId: 42,
    } as unknown as ISimpleDbBinanceDeposit);

    await expect(entity.getSessionList()).resolves.toEqual({
      sessions: [],
      activeLocalId: undefined,
    });
  });
});
