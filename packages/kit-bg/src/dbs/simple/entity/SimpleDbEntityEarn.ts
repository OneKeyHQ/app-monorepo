import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IEarnAtomData } from '@onekeyhq/shared/types/staking';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityEarn extends SimpleDbEntityBase<IEarnAtomData> {
  entityName = 'earnData';

  override enableCache = false;

  @backgroundMethod()
  async getEarnData() {
    const data = await this.getRawData();
    return data ?? { availableAssets: [] };
  }
}
