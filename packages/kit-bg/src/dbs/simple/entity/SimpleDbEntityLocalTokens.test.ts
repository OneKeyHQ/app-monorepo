import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

import type {
  IAccountTokenListCache,
  ISimpleDBLocalTokens,
} from './SimpleDbEntityLocalTokens';

type IRawDataBuilder = (
  rawData: ISimpleDBLocalTokens | null | undefined,
) => ISimpleDBLocalTokens;

type IGuardedWriter = {
  setRawDataWithCommitGuard: (
    builder: IRawDataBuilder,
    assertCanCommit?: () => void,
    onCommitted?: (data: ISimpleDBLocalTokens) => void,
  ) => Promise<ISimpleDBLocalTokens | undefined>;
};

function setup() {
  const entity = new SimpleDbEntityLocalTokens();
  let rawData: ISimpleDBLocalTokens | undefined;
  let failNextCommit = false;
  // Mirrors the base commit path: guard, build, guard, store, onCommitted.
  jest
    .spyOn(entity as unknown as IGuardedWriter, 'setRawDataWithCommitGuard')
    .mockImplementation(async (builder, assertCanCommit, onCommitted) => {
      assertCanCommit?.();
      const next = builder(rawData);
      assertCanCommit?.();
      if (failNextCommit) {
        failNextCommit = false;
        throw new OneKeyLocalError('storage unavailable');
      }
      rawData = next;
      onCommitted?.(next);
      return next;
    });
  const write = (tokenListValue: string, writeOrder?: number) =>
    entity.updateAccountTokenList({
      networkId: 'evm--1',
      accountAddress: 'fixture-address',
      tokenList: [],
      smallBalanceTokenList: [],
      riskyTokenList: [],
      tokenListMap: {},
      tokenListValue,
      currency: 'usd',
      writeOrder,
    });
  const writeBatch = (
    tokenListValue: Record<string, string>,
    tokenListWriteOrder?: Record<string, number>,
  ) => {
    const keys = Object.keys(tokenListValue);
    const byKey = <T>(value: T) =>
      Object.fromEntries(keys.map((key) => [key, value]));
    const cache: IAccountTokenListCache = {
      tokenList: byKey([]),
      smallBalanceTokenList: byKey([]),
      riskyTokenList: byKey([]),
      tokenListMap: byKey({}),
      tokenListValue,
      tokenListCurrency: byKey('usd'),
      tokenListWriteOrder,
    };
    return entity.updateAccountTokenListByCache(cache);
  };
  return {
    entity,
    write,
    writeBatch,
    getRawData: () => rawData,
    failNextCommit: () => {
      failNextCommit = true;
    },
  };
}

describe('SimpleDbEntityLocalTokens account token list write order', () => {
  afterEach(() => jest.restoreAllMocks());

  it('skips a response that started before the newest committed write for its key', async () => {
    const { entity, write, getRawData } = setup();
    const olderOrder = await entity.reserveAccountTokenListWriteOrder();
    const newerOrder = await entity.reserveAccountTokenListWriteOrder();

    await write('20', newerOrder);
    await expect(write('10', olderOrder)).resolves.toBeUndefined();

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '20',
    });
  });

  it('commits responses that arrive in request order', async () => {
    const { entity, write, getRawData } = setup();
    const olderOrder = await entity.reserveAccountTokenListWriteOrder();
    const newerOrder = await entity.reserveAccountTokenListWriteOrder();

    await write('10', olderOrder);
    await write('20', newerOrder);

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '20',
    });
  });

  it('keeps unordered writes unconditional', async () => {
    const { entity, write, getRawData } = setup();
    await write('20', await entity.reserveAccountTokenListWriteOrder());
    await write('10');

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '10',
    });
  });

  it('does not let a failed write block an older response', async () => {
    const { entity, write, getRawData, failNextCommit } = setup();
    const olderOrder = await entity.reserveAccountTokenListWriteOrder();
    const newerOrder = await entity.reserveAccountTokenListWriteOrder();

    failNextCommit();
    await expect(write('20', newerOrder)).rejects.toThrow(
      'storage unavailable',
    );
    await write('10', olderOrder);

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '10',
    });
  });

  it('drops batched entries older than the committed write for their key', async () => {
    const { entity, write, writeBatch, getRawData } = setup();
    const olderOrder = await entity.reserveAccountTokenListWriteOrder();
    const otherOrder = await entity.reserveAccountTokenListWriteOrder();
    const newerOrder = await entity.reserveAccountTokenListWriteOrder();

    await write('20', newerOrder);
    await writeBatch(
      { 'evm--1_fixture-address': '10', 'evm--56_fixture-address': '5' },
      {
        'evm--1_fixture-address': olderOrder,
        'evm--56_fixture-address': otherOrder,
      },
    );

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '20',
      'evm--56_fixture-address': '5',
    });
    expect(getRawData()?.tokenListCurrency).toEqual({
      'evm--1_fixture-address': 'usd',
      'evm--56_fixture-address': 'usd',
    });
  });

  it('lets a committed batch supersede older single-key writes', async () => {
    const { entity, write, writeBatch, getRawData } = setup();
    const olderOrder = await entity.reserveAccountTokenListWriteOrder();
    const newerOrder = await entity.reserveAccountTokenListWriteOrder();

    await writeBatch(
      { 'evm--1_fixture-address': '20' },
      { 'evm--1_fixture-address': newerOrder },
    );
    await write('10', olderOrder);

    expect(getRawData()?.tokenListValue).toEqual({
      'evm--1_fixture-address': '20',
    });
  });
});
