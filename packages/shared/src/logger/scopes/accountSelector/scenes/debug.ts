import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AccountSelectorDebugScene extends BaseScene {
  @LogToLocal()
  public repro(label: string, value?: unknown) {
    if (value === undefined) {
      return [label];
    }
    return [label, value];
  }
}
