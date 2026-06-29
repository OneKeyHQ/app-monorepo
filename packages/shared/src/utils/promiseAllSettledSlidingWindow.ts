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
      let settled: T | null;
      try {
        settled = await factories[index]();
      } catch (e) {
        if (!continueOnError) {
          errored = true;
          if (firstError === undefined) {
            firstError = e;
          }
          return;
        }
        settled = null;
      }
      results[index] = settled;
      // `onSettled` runs OUTSIDE the factory try so a throwing progress hook
      // can neither overwrite the stored result with null nor fire twice; a
      // misbehaving hook must not corrupt results or stop the pool.
      try {
        onSettled?.(settled, index);
      } catch {
        // intentionally ignored — progress hook errors don't affect the fan-out
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
