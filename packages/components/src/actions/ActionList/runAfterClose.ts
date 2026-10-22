import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export async function runAfterActionListClose<TResult>(
  close: () => void | Promise<void>,
  callback: () => TResult | Promise<TResult>,
  { waitForAnimation = true }: { waitForAnimation?: boolean } = {},
): Promise<TResult> {
  await close();
  if (waitForAnimation && !platformEnv.isNative) {
    await timerUtils.wait(150);
  }
  return callback();
}
