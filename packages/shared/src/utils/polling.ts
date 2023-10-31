/**
 * Calls a given function and keeps calling it after the specified delay has passed.
 *
 * @param fn The function to call.
 * @param delayOrDelayCallback The delay (in milliseconds) to wait before calling the function again. Can be a function.
 * @param shouldStopPolling A callback function indicating whether to stop polling.
 * @returns A Promise that resolves when the polling is stopped.
 */
export async function poll(
  fn: () => any,
  delayOrDelayCallback: number | (() => number),
  shouldStopPolling: () => boolean | Promise<boolean> = () => false,
): Promise<void> {
  do {
    await fn();

    if (await shouldStopPolling()) {
      break;
    }

    const delay =
      typeof delayOrDelayCallback === 'number'
        ? delayOrDelayCallback
        : delayOrDelayCallback();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
  } while (!(await shouldStopPolling()));
}
