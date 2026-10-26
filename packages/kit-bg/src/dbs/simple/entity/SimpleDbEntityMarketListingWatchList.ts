import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Older clients rewrite the legacy key, so keep listing favorites separately.
export class SimpleDbEntityMarketListingWatchList extends SimpleDbEntityBase<IMarketWatchListDataV2> {
  entityName = 'marketListingWatchList';

  override enableCache = false;
}
