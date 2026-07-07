import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Diagnostics for the extension WebAuthn gate on the lock-screen log-upload
// entry (see AppStateLock handleExportLogs). Written to local logs so a
// locked-out user can export them: captures the RAW WebAuthn error before it
// is collapsed into cancel/undefined, so a lost/corrupted platform credential
// can be told apart from a genuine user cancel.
export class WebAuthScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public log(message: string) {
    return message;
  }
}
