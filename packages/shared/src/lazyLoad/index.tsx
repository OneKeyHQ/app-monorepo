import { Component, Suspense, lazy, memo, useMemo, useState } from 'react';
import type { ComponentType, ErrorInfo, ReactNode } from 'react';

import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '../utils/appVisibility';

export const MAX_LAZY_RETRIES = 2;
const RETRY_BACKOFF_MS = [150, 600];
const RETRYABLE_CODES = new Set([
  'SPLIT_BUNDLE_NO_RUNTIME',
  'SPLIT_BUNDLE_TIMEOUT',
]);

// Exported for unit testing. A split-bundle segment timeout is TRANSIENT
// (installProdBundleLoader marks it retryable and does NOT cache it); only these
// re-attempt. Real eval failures (SPLIT_BUNDLE_EVAL_ERROR / IO_ERROR / NOT_FOUND
// / SHA256_MISMATCH) are non-retryable and must surface immediately.
export function isRetryableLazyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; retryable?: unknown; message?: unknown };
  if (e.retryable === true) return true;
  if (typeof e.code === 'string' && RETRYABLE_CODES.has(e.code)) return true;
  return (
    typeof e.message === 'string' &&
    e.message.includes('[SplitBundle]') &&
    e.message.includes('eval timed out')
  );
}

const delayImport = <T,>(
  factory: () => Promise<{ default: ComponentType<T> }>,
  delayMs: number,
) =>
  new Promise<{ default: ComponentType<T> }>((resolve) => {
    setTimeout(() => resolve(factory()), delayMs);
  });

// CRITICAL boundary semantics (this is the bug that sank one earlier draft):
// getDerivedStateFromError sets a NON-throwing 'retrying' holding state (render
// shows the fallback). render() must throw ONLY in the terminal 'fatal' state.
// The retry-vs-fatal decision happens in componentDidCatch (commit phase). If
// render() re-threw whenever an error was captured, it would escalate to the
// root boundary BEFORE the retry could run.
class LazyRetryBoundary extends Component<
  {
    children: ReactNode;
    fallback?: ReactNode;
    maxRetries: number;
    onRetry: () => void;
  },
  { phase: 'ok' | 'retrying' | 'fatal'; error: unknown; retries: number }
> {
  private unsubscribe?: () => void;

  private retryTimer?: ReturnType<typeof setTimeout>;

  override state: {
    phase: 'ok' | 'retrying' | 'fatal';
    error: unknown;
    retries: number;
  } = { phase: 'ok', error: undefined, retries: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { phase: 'retrying' as const, error };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo) {
    if (
      !isRetryableLazyError(error) ||
      this.state.retries >= this.props.maxRetries
    ) {
      this.setState({ phase: 'fatal' });
      return;
    }
    const nextRetries = this.state.retries + 1;
    NativeLogger.write(
      LogLevel.Warning,
      `[LazyLoad] retryable segment error (attempt ${nextRetries}/${this.props.maxRetries})`,
    );
    const backoff =
      RETRY_BACKOFF_MS[Math.min(nextRetries - 1, RETRY_BACKOFF_MS.length - 1)];
    const fire = () => {
      this.props.onRetry(); // regenerate the lazy() object in the parent
      this.setState({ phase: 'ok', error: undefined, retries: nextRetries });
    };
    if (getCurrentVisibilityState()) {
      this.retryTimer = setTimeout(fire, backoff);
    } else {
      // Backgrounded (the suspend false-positive window): defer until foreground,
      // when the buffered runtime executor is about to flush; retrying while
      // suspended just burns the budget.
      this.unsubscribe = onVisibilityStateChange((visible) => {
        if (visible) {
          this.unsubscribe?.();
          this.unsubscribe = undefined;
          this.retryTimer = setTimeout(fire, backoff);
        }
      });
    }
  }

  override componentWillUnmount() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    // Clear any pending retry-backoff timer so an unmount during the backoff
    // window can't fire onRetry()/setState() on an unmounted boundary.
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  override render() {
    if (this.state.phase === 'fatal') throw this.state.error;
    if (this.state.phase === 'retrying') return this.props.fallback ?? null;
    return this.props.children;
  }
}

function LazyLoad<T = Record<string, unknown>>(
  factory: () => Promise<{ default: ComponentType<T> }>,
  delayMs?: number,
  fallback?: React.ReactNode,
) {
  const wrappedFactory =
    delayMs && delayMs > 0 ? () => delayImport(factory, delayMs) : factory;
  function LazyLoadContainer(props: T) {
    const [retryKey, setRetryKey] = useState(0);
    const LazyLoadComponent = useMemo(
      () =>
        lazy(() =>
          wrappedFactory().catch((err: Error) => {
            NativeLogger.write(
              LogLevel.Error,
              `[LazyLoad] FAILED: ${err?.message || err}\n${err?.stack?.slice(0, 300) || ''}`,
            );
            throw err;
          }),
        ),
      // regenerate a fresh lazy() object each retry — React caches the rejected
      // payload on the lazy object, so only a NEW object re-invokes the factory.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [retryKey],
    );
    return (
      <LazyRetryBoundary
        maxRetries={MAX_LAZY_RETRIES}
        fallback={fallback}
        onRetry={() => setRetryKey((k) => k + 1)}
      >
        <Suspense fallback={fallback}>
          {/* `as any`: the generic prop bag `T` cannot be spread into JSX
              directly (TS can't prove `T` is a valid props object for the
              lazily-typed component); the cast is unavoidable and safe because
              `props` is exactly what the caller typed `LazyLoad<T>` with. */}
          <LazyLoadComponent {...(props as any)} />
        </Suspense>
      </LazyRetryBoundary>
    );
  }
  return memo(LazyLoadContainer);
}

export default LazyLoad;
