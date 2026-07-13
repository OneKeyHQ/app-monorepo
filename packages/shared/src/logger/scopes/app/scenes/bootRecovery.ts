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

  // Warning-level signal for the web/desktop cold-start gate: the source-of-
  // truth atom / cold-start hydration handlers did not settle within the
  // safety timeout, so React was force-mounted with default atom values.
  // Distinct from `log` so post-incident filtering can isolate degraded boots.
  @LogToLocal({ level: 'warn' })
  public coldStartGateTimeout(message: string) {
    return message;
  }
}
