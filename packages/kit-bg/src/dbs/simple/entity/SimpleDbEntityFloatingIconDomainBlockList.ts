import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityFloatingIconDomainBlockList extends SimpleDbEntityBase<
  string[]
> {
  entityName = 'floatingIconDomainBlockList';

  override enableCache = false;

  @backgroundMethod()
  async getList(): Promise<string[]> {
    const result = await this.getRawData();
    return result ?? [];
  }
}
