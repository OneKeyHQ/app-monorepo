import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SimpleDbEntityAggregateToken } from './SimpleDbEntityAggregateToken';

it('broadcasts extension Home defaults only after the aggregate config write commits', async () => {
  const entity = new SimpleDbEntityAggregateToken();
  const previousPlatform = platformEnv.isExtensionBackground;
  platformEnv.isExtensionBackground = true;
  const notify = jest.fn();
  appEventBus.on(EAppEventBusNames.HomeDefaultTokensUpdated, notify);
  try {
    let commit!: () => void;
    const write = jest.spyOn(entity, 'setRawData').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          commit = () => resolve({ homeDefaultTokenMap: {} });
        }),
    );
    const sync = entity.updateAllAggregateInfo({
      aggregateTokenConfigMap: {},
      aggregateTokenSymbolMap: {},
      homeDefaultTokenMap: {},
      allAggregateTokenMap: {},
      allAggregateTokens: [],
    });
    expect(notify).not.toHaveBeenCalled();
    commit();
    await sync;
    expect(notify).toHaveBeenCalledTimes(1);

    write.mockResolvedValueOnce(undefined);
    await entity.updateHomeDefaultTokenMap({ homeDefaultTokenMap: {} });
    expect(notify).toHaveBeenCalledTimes(1);
  } finally {
    platformEnv.isExtensionBackground = previousPlatform;
    appEventBus.off(EAppEventBusNames.HomeDefaultTokensUpdated, notify);
    jest.restoreAllMocks();
  }
});

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
