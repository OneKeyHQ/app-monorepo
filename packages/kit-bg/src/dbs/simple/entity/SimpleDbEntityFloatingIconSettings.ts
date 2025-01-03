import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IFloatingIconSettings {
  position: {
    side: 'left' | 'right';
    bottom: string;
  };
}

export class SimpleDbEntityFloatingIconSettings extends SimpleDbEntityBase<IFloatingIconSettings> {
  entityName = 'floatingIconSettings';

  override enableCache = false;

  @backgroundMethod()
  async getSettings(): Promise<IFloatingIconSettings> {
    const result = await this.getRawData();
    return (
      result ?? {
        position: {
          side: 'right',
          bottom: '30%',
        },
      }
    );
  }
}
