import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class MarketWidgetScene extends BaseScene {
  @LogToLocal()
  public event(
    event: string,
    details: Record<string, string | number | boolean | undefined>,
  ) {
    return { event, ...details };
  }
}
