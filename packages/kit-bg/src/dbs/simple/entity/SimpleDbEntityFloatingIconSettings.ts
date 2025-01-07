import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IFloatingIconSettings {
  position: {
    side: 'left' | 'right';
    bottom: string;
  };
}

const DEFAULT_POSITION: IFloatingIconSettings['position'] = {
  side: 'right',
  bottom: '30%',
};

export class SimpleDbEntityFloatingIconSettings extends SimpleDbEntityBase<IFloatingIconSettings> {
  entityName = 'floatingIconSettings';

  override enableCache = false;

  @backgroundMethod()
  async getSettings(): Promise<IFloatingIconSettings> {
    const result =
      (await this.getRawData()) || ({} as Partial<IFloatingIconSettings>);
    const position = result.position || DEFAULT_POSITION;
    return {
      position,
    };
  }

  @backgroundMethod()
  async setSettings(settings: Partial<IFloatingIconSettings> | undefined) {
    if (!settings) {
      return;
    }
    const dbSettings = await this.getSettings();
    const position = settings.position || dbSettings.position;
    await this.setRawData({
      position: {
        side: position.side || DEFAULT_POSITION.side,
        bottom: position.bottom || DEFAULT_POSITION.bottom,
      },
    });
  }
}
