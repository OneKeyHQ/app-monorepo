import { SimpleDbEntityLocalTokens } from './SimpleDbEntityLocalTokens';

import type { ISimpleDBLocalTokens } from './SimpleDbEntityLocalTokens';

type IRawDataBuilder = (
  rawData: ISimpleDBLocalTokens | null | undefined,
) => ISimpleDBLocalTokens;

type IGuardedWriter = {
  setRawDataWithCommitGuard: (
    builder: IRawDataBuilder,
    assertCanCommit?: () => void,
  ) => Promise<ISimpleDBLocalTokens | undefined>;
};

function setup() {
  const entity = new SimpleDbEntityLocalTokens();
  let rawData: ISimpleDBLocalTokens | undefined;
  // Mirrors the base commit path: guard, build, guard, commit.
  jest
    .spyOn(entity as unknown as IGuardedWriter, 'setRawDataWithCommitGuard')
    .mockImplementation(async (builder, assertCanCommit) => {
      assertCanCommit?.();
      const next = builder(rawData);
      assertCanCommit?.();
      rawData = next;
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
  return { entity, write, getRawData: () => rawData };
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
});
