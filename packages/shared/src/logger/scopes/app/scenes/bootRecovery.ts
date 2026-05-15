import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Dedicated channel for BootRecovery health monitoring (markBootSuccess,
// counter inspection, recovery decisions). Kept separate from `appUpdate`
// so post-incident filtering for "why didn't markBootSuccess take effect?"
// doesn't have to wade through OTA traffic.
export class BootRecoveryScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(message: string) {
    return message;
  }
}
