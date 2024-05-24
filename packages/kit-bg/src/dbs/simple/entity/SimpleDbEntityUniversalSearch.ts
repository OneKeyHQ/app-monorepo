import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IUniversalSearchAtomData } from '@onekeyhq/shared/types/search';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export class SimpleDbEntityUniversalSearch extends SimpleDbEntityBase<IUniversalSearchAtomData> {
  entityName = 'universalSearch';

  override enableCache = false;

  @backgroundMethod()
  async getData() {
    const data = await this.getRawData();
    return data ?? { recentSearch: [] };
  }
}
