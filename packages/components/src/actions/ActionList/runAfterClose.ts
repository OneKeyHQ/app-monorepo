import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { OverlayCloseCancelledError } from '../../shared/overlayCloseCancellation';

export async function runAfterActionListClose<TResult>(
  close: () => void | Promise<void>,
  callback: () => TResult | Promise<TResult>,
  { waitForAnimation = true }: { waitForAnimation?: boolean } = {},
): Promise<TResult | undefined> {
  let closeResult: void | Promise<void>;
  try {
    closeResult = close();
    await closeResult;
  } catch (error) {
    if (error instanceof OverlayCloseCancelledError) return undefined;
    throw error;
  }
  if (
    waitForAnimation &&
    (!platformEnv.isNative || closeResult === undefined)
  ) {
    await timerUtils.wait(150);
  }
  return callback();
}
