import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityFloatingIconPosition extends SimpleDbEntityBase<{
  side: 'left' | 'right';
  bottom: string;
}> {
  entityName = 'floatingIconPosition';

  override enableCache = false;

  @backgroundMethod()
  async position(): Promise<{
    side: 'left' | 'right';
    bottom: string;
  }> {
    const result = await this.getRawData();
    return (
      result ?? {
        side: 'right',
        bottom: '30%',
      }
    );
  }
}
