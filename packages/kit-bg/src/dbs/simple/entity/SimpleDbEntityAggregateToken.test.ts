import { SimpleDbEntityAggregateToken } from './SimpleDbEntityAggregateToken';

describe('getAggregateTokenConfigSnapshot', () => {
  const entity = new SimpleDbEntityAggregateToken();

  afterEach(() => jest.restoreAllMocks());

  it.each([undefined, null, {}])(
    'preserves missing config for wallet-config sync (%s)',
    async (rawData) => {
      jest.spyOn(entity, 'getRawData').mockResolvedValue(rawData);
      expect(await entity.getAggregateTokenConfigSnapshot()).toEqual({
        aggregateTokenConfigMap: undefined,
      });
    },
  );

  it('preserves an explicitly empty config without returning account assets', async () => {
    const aggregateTokenConfigMap = {};
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      aggregateTokenConfigMap,
      aggregateTokenMap: {
        unrelated: {
          token: {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '1',
            price: 1,
          },
        },
      },
      tokenDetails: { unrelated: { token: { lastActiveTabName: 'history' } } },
    });
    const result = await entity.getAggregateTokenConfigSnapshot();
    expect(result.aggregateTokenConfigMap).toBe(aggregateTokenConfigMap);
    expect(JSON.parse(JSON.stringify(result))).toEqual({
      aggregateTokenConfigMap: {},
    });
  });
});
