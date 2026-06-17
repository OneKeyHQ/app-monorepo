import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

/**
 * A sliding-window (worker-pool) concurrency executor.
 *
 * Unlike `promiseAllSettledEnhanced`, which runs fixed batches and waits for the
 * WHOLE batch to settle before starting the next (a barrier — one slow task
 * idles every other slot in its wave), this keeps exactly `concurrency` tasks in
 * flight and starts the next waiting task the instant any one settles. For the
 * all-network token fan-out that removes the per-wave straggler stall.
 *
 * - Results are returned in INPUT order (callers index into them).
 * - `onSettled(result, index)` fires once per task as it settles (completion
 *   order) — the per-network hook progressive paint (L2) consumes.
 * - With `continueOnError`, a throwing task resolves to `null` in results (and
 *   `onSettled` receives `null`), mirroring `promiseAllSettledEnhanced`.
 *   Without it, the first error is rethrown after in-flight tasks settle.
 */
export async function promiseAllSettledSlidingWindow<T>(
  factories: (() => Promise<T>)[],
  options?: {
    concurrency?: number;
    continueOnError?: boolean;
    onSettled?: (result: T | null, index: number) => void;
  },
): Promise<(T | null)[]> {
  const {
    concurrency = factories.length,
    continueOnError,
    onSettled,
  } = options ?? {};

  const results: (T | null)[] = new Array<T | null>(factories.length).fill(
    null,
  );
  if (factories.length === 0) {
    return results;
  }

  const limit = Math.max(1, Math.min(concurrency, factories.length));
  let nextIndex = 0;
  let errored = false;
  let firstError: unknown;

  const worker = async (): Promise<void> => {
    while (true) {
      if (errored && !continueOnError) {
        return;
      }
      const index = nextIndex;
      if (index >= factories.length) {
        return;
      }
      nextIndex += 1;
      try {
        const value = await factories[index]();
        results[index] = value;
        onSettled?.(value, index);
      } catch (e) {
        if (!continueOnError) {
          errored = true;
          if (firstError === undefined) {
            firstError = e;
          }
          return;
        }
        results[index] = null;
        onSettled?.(null, index);
      }
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));

  if (errored && !continueOnError) {
    // Re-throw the first task error verbatim (mirrors Promise.all semantics);
    // wrap non-Error throwables so the thrown value is always an Error.
    throw firstError instanceof Error
      ? firstError
      : new OneKeyLocalError(String(firstError));
  }
  return results;
}
