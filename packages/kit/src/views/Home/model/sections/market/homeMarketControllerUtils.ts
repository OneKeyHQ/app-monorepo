import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { normalizeHomeStoreJson } from '../../store/homeStoreJson';

import { getHomeMarketRowIds } from './homeMarketSourceAdapter';

import type { IHomePopularTradingPayload } from '../../../components/PopularTrading/types';
import type { IHomeSectionSourceRequestHandle } from '../../react/useHomeStoreSourcePublisher';

type IHomeMarketRequestGateway = {
  begin: () => IHomeSectionSourceRequestHandle;
  complete: (
    handle: IHomeSectionSourceRequestHandle,
    result:
      | { kind: 'empty' }
      | { kind: 'error' }
      | {
          kind: 'ready';
          rowIds: readonly string[];
          data: IHomeRuntimeJsonValue;
          freshness: 'live';
          refresh: 'idle';
        },
  ) => void;
};

function getSelectedHomeMarketCategory(
  value: unknown,
  fallbackCategoryId: string,
): string {
  return typeof value === 'string' && value ? value : fallbackCategoryId;
}

async function runHomeMarketStoreRequest({
  gateway,
  load,
}: {
  gateway: IHomeMarketRequestGateway;
  load: () => Promise<IHomePopularTradingPayload>;
}): Promise<void> {
  const handle = gateway.begin();
  try {
    const payload = await load();
    const data = normalizeHomeStoreJson(payload);
    if (data === undefined) {
      throw new OneKeyLocalError('Invalid Home Market Store payload');
    }
    gateway.complete(
      handle,
      payload.categories.length > 0 || payload.rows.length > 0
        ? {
            kind: 'ready',
            rowIds: getHomeMarketRowIds(payload),
            data,
            freshness: 'live',
            refresh: 'idle',
          }
        : { kind: 'empty' },
    );
  } catch (error) {
    gateway.complete(handle, { kind: 'error' });
    throw error;
  }
}

export { getSelectedHomeMarketCategory, runHomeMarketStoreRequest };
export type { IHomeMarketRequestGateway };
