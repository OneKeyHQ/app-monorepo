/**
 * Sentry event processor that tags "Requiring unknown module <id>" events.
 *
 * Why a processor (not setTag in our global error handler):
 *   `@sentry/react-native`'s ReactNativeErrorHandlers integration wraps
 *   ErrorUtils.setGlobalHandler such that Sentry CAPTURES the event BEFORE
 *   invoking our wrapped handler. So setTag from inside the handler:
 *     1) misses the actual crash event (already in flight), AND
 *     2) mutates GLOBAL scope — leaking the tag onto the next unrelated event.
 *
 * The processor below mutates the event being prepared, derived from
 * `hint.originalException`. Tags are scoped to the matching event only;
 * unrelated events pass through untouched.
 *
 * (cross-ref) Classifier lives in ./unknownModuleHandler.ts.
 */

import { classifyUnknownModuleError } from './unknownModuleHandler';

// Minimal Sentry shape we depend on. We type the parameter loosely so the
// signature is compatible with `@sentry/react-native`'s exported
// `addEventProcessor(callback: EventProcessor)` (where EventProcessor's
// arguments are the SDK's `Event` / `EventHint` types). The processor we
// register is shape-compatible: it reads `hint.originalException`, mutates
// `event.tags`/`event.extra`, and returns the event.
export interface ISentryEventProcessorHost {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventProcessor: (processor: (event: any, hint: any) => any) => void;
}

export interface ISentryEvent {
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ISentryEventHint {
  originalException?: unknown;
  [key: string]: unknown;
}

export interface ISplitBundleSentryEventProcessorDeps {
  sentry: ISentryEventProcessorHost;
  getBundleVersion: () => string | undefined;
}

/**
 * Build the event processor in isolation so tests can drive it directly
 * without registering anything on a Sentry instance.
 */
export function buildSplitBundleEventProcessor(
  getBundleVersion: () => string | undefined,
): (event: ISentryEvent, hint?: ISentryEventHint) => ISentryEvent {
  return (event, hint) => {
    try {
      const classification = classifyUnknownModuleError(
        hint?.originalException,
      );
      if (!classification) return event;
      event.tags = {
        ...event.tags,
        split_bundle_integrity: 'true',
        split_bundle_unknown_module_id: classification.moduleId,
      };
      let bundleVersion: string | undefined;
      try {
        bundleVersion = getBundleVersion();
      } catch {
        bundleVersion = undefined;
      }
      event.extra = {
        ...event.extra,
        bundle_version: bundleVersion ?? 'unknown',
      };
    } catch {
      // Never let a processor failure break Sentry's pipeline.
    }
    return event;
  };
}

/**
 * Register the processor on the supplied Sentry host.
 *
 * Must run AFTER initSentry() so the SDK's isolation scope is up.
 */
export function installSplitBundleSentryEventProcessor(
  deps: ISplitBundleSentryEventProcessorDeps,
): void {
  const processor = buildSplitBundleEventProcessor(deps.getBundleVersion);
  deps.sentry.addEventProcessor(processor);
}
