// ============ Logging Utilities ============
// onekey: flags come from debugFlags.ts instead of process.env — no bundler
// `process` shim, and the extension/native bundles have no `process` at all.
import { getSdkDebugFlag, type SdkDebugFlagName } from "../debugFlags";
import { toHex } from "./convert";

const getEnv = (key: SdkDebugFlagName): string | undefined => getSdkDebugFlag(key);

// --- Tracing Context ---

type TraceContext = {
  id: string; // e.g. "1.2"
  childCounter: number; // Counter for children
};

// onekey: upstream loaded node:async_hooks via `require("async_hooks")` behind a
// `typeof window === "undefined"` guard. The guard is false on React Native, and
// Metro resolves the literal at bundle time regardless, so it broke the native
// build. Trace IDs now always come from the counter fallback below; nothing in
// the SDK depends on async context propagation.
type TraceStorage = {
  getStore(): TraceContext | undefined;
  run<T>(context: TraceContext, fn: () => T): T;
};
// `let` (never reassigned) keeps TS from narrowing the value to `undefined`
// at the call sites below, which still read as the upstream code did.
// eslint-disable-next-line prefer-const
let traceStorage: TraceStorage | undefined;

let rootTraceCounter = 0;

function getTraceId(): string {
  if (traceStorage) {
    const current = traceStorage.getStore();
    if (current) {
      current.childCounter++;
      return `${current.id}.${current.childCounter}`;
    }
  }
  rootTraceCounter++;
  return `${rootTraceCounter}`;
}

// --- Types ---

export type LogPhase = "ENTER" | "EXIT" | "ERROR";

/** Callback type for logging method calls */
export type LogCallback = (
  targetName: string,
  methodName: string,
  args: unknown[],
  result: unknown, // result or error
  phase: LogPhase,
  traceId: string
) => void;

/**
 * Wraps an object to intercept all method calls and invoke a callback.
 * Useful for debugging/logging.
 *
 * @param target - The object to wrap
 * @param name - Name to identify this object in logs
 * @param callback - Function called for each method invocation (with result after execution)
 */
export function withLogging<T extends object>(target: T, name: string, callback: LogCallback): T {
  // Skip proxy overhead if debug is not enabled for this target
  if (!isDebugEnabledForTarget(name)) {
    return target;
  }
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value === "function" && typeof prop === "string" && !prop.startsWith("_")) {
        return function (this: unknown, ...args: unknown[]) {
          const traceId = getTraceId();
          const context: TraceContext = { id: traceId, childCounter: 0 };

          const executeWithLogging = () => {
            try {
              // Log Enter
              callback(name, prop, args, undefined, "ENTER", traceId);

              // Apply on 'this' (which is the proxy if called via proxy) to ensure internal calls
              // also go through the proxy.
              const result = value.apply(this, args);

              // Handle promises - log result when resolved
              if (result instanceof Promise) {
                return result.then(
                  (resolved) => {
                    callback(name, prop, args, resolved, "EXIT", traceId);
                    return resolved;
                  },
                  (error) => {
                    callback(name, prop, args, error, "ERROR", traceId);
                    throw error;
                  }
                );
              }

              callback(name, prop, args, result, "EXIT", traceId);
              return result;
            } catch (error) {
              callback(name, prop, args, error, "ERROR", traceId);
              throw error;
            }
          };

          // Use AsyncLocalStorage if available (Node.js), otherwise just execute
          if (traceStorage) {
            return traceStorage.run(context, executeWithLogging);
          }
          return executeWithLogging();
        };
      }
      return value;
    },
  });
}

/** Debug flag name; see debugFlags.ts. */
export const DEBUG_ENV_VAR = "SDK_DEBUG";

/** Check if debug logging is enabled */
export const isDebugEnabled = (targetName?: string) => {
  const env = getEnv(DEBUG_ENV_VAR);
  if (!env) return false;
  if (env === "1" || env === "true") return true;
  if (targetName) {
    const patterns = env.split(",");
    // Check for exact match or prefix match (pattern + ".")
    // e.g. "foo" matches "foo" and "foo.bar"
    return patterns.some((p) => targetName === p || targetName.startsWith(`${p}.`));
  }
  return false;
};

/** Check if debug logging could be enabled for any method of a target */
const isDebugEnabledForTarget = (name: string) => {
  const env = getEnv(DEBUG_ENV_VAR);
  if (!env) return false;
  if (env === "1" || env === "true") return true;
  const patterns = env.split(",");
  // Check if any pattern matches this target or is a prefix of target methods
  // e.g. "foo" or "foo.bar" patterns would enable logging for target "foo"
  return patterns.some((p) => p === name || p.startsWith(`${name}.`) || name.startsWith(`${p}.`));
};

// ANSI color codes
const CYAN = 36;
const GREEN = 32;
const RED = 31;

// Check if we are in a TTY environment or if color is forced
const useColor = () => {
  if (getEnv("SDK_DEBUG_COLOR") === "0" || getEnv("NO_COLOR")) return false;
  if (getEnv("SDK_DEBUG_COLOR") === "1" || getEnv("FORCE_COLOR")) return true;
  // onekey: dropped the `process.stdout.isTTY` probe — no `process` in app bundles.
  return false;
};

/** Apply color if environment supports it */
const color = (text: string, code: number) => {
  if (!useColor()) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
};

// ... existing code ...

/** Get current timestamp as HH:MM:SS.mmm */
const getTimestamp = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
};

const createReplacer = () => {
  const seen = new WeakSet();
  return (_: string, v: unknown) => {
    if (typeof v === "bigint") return toHex(v);
    if (typeof v === "function") return "[Function]";
    if (v instanceof Uint8Array) return toHex(v);
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (v instanceof Map)
        return {
          dataType: "Map",
          value: Array.from(v.entries()),
        };
      if (v instanceof Set) return Array.from(v);
    }
    return v;
  };
};

/**
 * Console logging callback for use with withLogging.
 * Logs method calls to console in format: [TraceID] [TargetName.method] -> (args)
 * Only logs when SDK_DEBUG environment variable is set.
 */
export const consoleLogCallback: LogCallback = (
  targetName,
  methodName,
  args,
  result,
  phase,
  traceId
) => {
  // Check if debug is enabled for the specific method path
  if (!isDebugEnabled(`${targetName}.${methodName}`)) return;

  const format = (value: unknown): string => {
    return JSON.stringify(value, createReplacer());
  };

  const timestamp = color(`[${getTimestamp()}]`, 90); // Gray color for timestamp
  const prefix = color(`[${traceId}] [${targetName}.${methodName}]`, CYAN);

  if (phase === "ENTER") {
    const argsStr = args.map(format).join(", ");
    console.log(`${timestamp} ${prefix} ${color("→", GREEN)} (${argsStr})`);
  } else if (phase === "EXIT") {
    console.log(`${timestamp} ${prefix} ${color("←", GREEN)} ${format(result)}`);
  } else if (phase === "ERROR") {
    const err = result instanceof Error ? result : new Error(String(result));
    console.log(`${timestamp} ${prefix} ${color("✖", RED)} ${err.message}`);
  }
};

/**
 * Log arbitrary messages if debug is enabled for the target.
 * Function arguments are lazily evaluated - they're only called if debug is enabled.
 * This allows passing expensive computations like: debugLog("x", "y", "msg", () => expensiveCall())
 */
export const debugLog = (target: string, sub: string, ...args: unknown[]) => {
  if (isDebugEnabled(`${target}.${sub}`)) {
    // Attempt to get current trace ID if inside a logged context
    const current = traceStorage?.getStore();
    const traceId = current ? current.id : "?";

    const timestamp = color(`[${getTimestamp()}]`, 90); // Gray color for timestamp

    // Evaluate function arguments lazily (only now that we know debug is enabled)
    const evaluatedArgs = args.map((arg) => (typeof arg === "function" ? arg() : arg));

    console.log(
      timestamp,
      color(`[${traceId}] [${target}.${sub}]`, CYAN),
      ...evaluatedArgs.map((arg) =>
        typeof arg === "string" ? arg : JSON.stringify(arg, createReplacer(), 2)
      )
    );
  }
};

/** No-op logging callback - does nothing */
export const noopLogCallback: LogCallback = () => {};

/** Helper message to show when tests fail */
export const debugHint = `\nTip: Run with ${DEBUG_ENV_VAR}=1 for detailed logging`;
