import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import {
  invalidateAllNetworksCompatCache,
  registerAllNetworksCompatCacheInvalidation,
} from './allNetworksCompatCacheInvalidation';

/*
yarn jest packages/kit/src/hooks/allNetworksCompatCacheInvalidation.test.ts
*/

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { removeByPrefix: jest.fn() },
}));

const removeByPrefix = swrCacheUtils.removeByPrefix as jest.Mock;

beforeEach(() => {
  removeByPrefix.mockClear();
});

describe('allNetworksCompatCacheInvalidation', () => {
  it('drops the whole compat namespace, not just the current scope', () => {
    invalidateAllNetworksCompatCache();
    expect(removeByPrefix).toHaveBeenCalledWith('allNetCompat:');
  });

  // Slack 09-22 QA report: after unchecking networks in the manager, switching
  // to another account first showed that account's cached chip from the old
  // selection ("+112") until its query re-ran. The cache is keyed per account,
  // so an enabled-set change has to invalidate every account's entry.
  it('invalidates when the enabled network set changes', () => {
    registerAllNetworksCompatCacheInvalidation();
    registerAllNetworksCompatCacheInvalidation();

    appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);

    expect(removeByPrefix).toHaveBeenCalledTimes(1);
    expect(removeByPrefix).toHaveBeenCalledWith('allNetCompat:');
  });
});
