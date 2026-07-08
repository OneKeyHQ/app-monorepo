import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { Keyboard } from '../../content/Keyboard';

export function runPopoverOpenSideEffects(trackID?: string) {
  if (trackID) {
    defaultLogger.ui.popover.popoverOpen({
      trackId: trackID,
    });
  }
  void Keyboard.dismissWithDelay(50);
}

export function runPopoverCloseSideEffects(trackID?: string) {
  if (trackID) {
    defaultLogger.ui.popover.popoverClose({
      trackId: trackID,
    });
  }
  void Keyboard.dismissWithDelay(50);
}
