import { isString } from 'lodash';

import type { IntlShape } from 'react-intl';

/**
 * Plain `Error` subclass produced by `unwrapElectronIpcError`. Intentionally
 * decoupled from `OneKeyError` so this module stays a leaf and can be imported
 * from any test environment without pulling in `react-intl`-backed locale
 * machinery at load time.
 */
export class UnwrappedIpcError extends Error {
  override name = 'UnwrappedIpcError';

  code?: number;

  data?: unknown;

  // Set by the Desktop API proxy; see attachDesktopIpcCallContext.
  ipcModule?: string;

  ipcMethod?: string;

  constructor(
    message: string,
    options?: { code?: number; data?: unknown; cause?: unknown },
  ) {
    super(message);
    if (options?.code !== undefined) {
      this.code = options.code;
    }
    if (options?.data !== undefined) {
      this.data = options.data;
    }
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

// cspell:ignore pkexec

/**
 * Wire prefix used by update errors that cross the Electron IPC boundary.
 * Kept in this leaf module so both the renderer-side decoder and the
 * main-process error serializer can share it without importing the heavier
 * update-error / locale modules.
 */
export const UPDATE_ERROR_WIRE_PREFIX = 'ONEKEY_UPDATE_ERROR:';

/**
 * Main-process (sender) side of the DESKTOP_API_CALL IPC boundary: normalize
 * errors so Electron's structured clone never throws "An object could not be
 * cloned" (notably for execFile/pkexec errors on Linux/flatpak). The `.message`
 * is preserved verbatim so the renderer-side counterpart,
 * `unwrapElectronIpcError` (this module), can still recover any
 * `{ message, code, data }` payload encoded in it.
 */
export function makeIpcSafeError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (error instanceof Error) {
    const message = error.message || fallbackMessage;
    const safeError = new Error(message);
    if (!message.startsWith(UPDATE_ERROR_WIRE_PREFIX)) {
      safeError.name = error.name || 'Error';
    }
    safeError.stack = error.stack;
    return safeError;
  }

  if (typeof error === 'string' && error) {
    return new Error(error);
  }

  return new Error(fallbackMessage);
}

const IPC_WRAP_PATTERN =
  /^Error invoking remote method '([^']+)':\s*([\s\S]+)$/;

type IIntlMessageResolver = Pick<IntlShape, 'formatMessage'> &
  Partial<Pick<IntlShape, 'messages'>>;
type IIntlMessageId = FormatjsIntl.Message['ids'];

const hasIntlMessage = (
  intl: IIntlMessageResolver | undefined,
  id: string,
): id is IIntlMessageId =>
  Boolean(
    intl?.messages && Object.prototype.hasOwnProperty.call(intl.messages, id),
  );

const getAppLocaleIntl = (): IIntlMessageResolver => {
  // Lazy require keeps this module free of `react-intl` at load time so
  // tests that stub `react-intl` (without providing `createIntl`) can still
  // import code paths that reach this file.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const appLocaleModule: typeof import('../../locale/appLocale') = require('../../locale/appLocale');
  return appLocaleModule.appLocale.intl;
};

type IUnwrappedPayload = {
  message: string;
  code?: number;
  data?: unknown;
};

const parseInnerPayload = (tail: string): IUnwrappedPayload => {
  const trimmed = tail.trim().replace(/^Error:\s*/, '');
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as {
        message?: unknown;
        code?: unknown;
        data?: unknown;
      };
      if (isString(obj.message)) {
        return {
          message: obj.message,
          code: typeof obj.code === 'number' ? obj.code : undefined,
          data: obj.data,
        };
      }
    }
  } catch {
    // Not JSON; fall through to plain-text parsing.
  }
  // Strip a leading "Error: " so a main-process `throw new Error('boom')`
  // surfaces as "boom" instead of "Error: boom".
  const withoutErrorPrefix = trimmed.replace(/^Error:\s*/, '');
  return { message: withoutErrorPrefix };
};

/**
 * Unwraps the `"Error invoking remote method 'CHANNEL': <payload>"` envelope
 * that Electron's `ipcRenderer.invoke` adds when the main-process handler
 * rejects.
 *
 * - If the inner payload is a serialized `OneKeyError` (JSON with `message`,
 *   optional `code`, `data`), the returned error has those fields restored.
 * - If the inner payload is a plain string (from `throw new Error('...')` in
 *   main), the returned error's message is that string.
 * - The original IPC error is kept on `.cause` so stack traces remain
 *   recoverable.
 * - Inputs that are not an IPC-wrapped `Error` are returned unchanged.
 */
export function unwrapElectronIpcError(err: unknown): unknown {
  if (!err || typeof err !== 'object') {
    return err;
  }
  const { message } = err as { message?: unknown };
  if (!isString(message)) {
    return err;
  }
  const match = IPC_WRAP_PATTERN.exec(message);
  if (!match) {
    return err;
  }
  const [, , tail] = match;
  const payload = parseInnerPayload(tail);
  return new UnwrappedIpcError(payload.message, {
    code: payload.code,
    data: payload.data,
    cause: err,
  });
}

export type IDesktopIpcCallContext = {
  ipcModule: string;
  ipcMethod: string;
};

// Module/method names come from proxy property access in code; anything else
// is not reported.
const IPC_CALL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
// Callers may wrap a Desktop API error (e.g. SupabaseStorageTransientError);
// follow `cause` a few levels to find the original call.
const MAX_IPC_ERROR_CAUSE_DEPTH = 5;

const isIpcCallName = (value: unknown): value is string =>
  isString(value) && IPC_CALL_NAME_PATTERN.test(value);

/**
 * Records which Desktop API call (module/method) rejected, on the error the
 * proxy rethrows. Only the message crosses the IPC boundary, so this is the
 * single place that still knows the failing call; diagnostics read it back
 * with `getDesktopIpcCallContext` instead of parsing free text. Params and
 * results are never recorded.
 */
export function attachDesktopIpcCallContext<T>(
  error: T,
  { module, method }: { module: string; method: string },
): T {
  if (
    !error ||
    typeof error !== 'object' ||
    !isIpcCallName(module) ||
    !isIpcCallName(method)
  ) {
    return error;
  }
  try {
    Object.assign(error, { ipcModule: module, ipcMethod: method });
  } catch {
    // Frozen errors keep their original shape.
  }
  return error;
}

const findInIpcErrorCauseChain = <T>(
  error: unknown,
  pick: (item: object) => T | undefined,
): T | undefined => {
  let current = error;
  for (
    let depth = 0;
    depth < MAX_IPC_ERROR_CAUSE_DEPTH && current && typeof current === 'object';
    depth += 1
  ) {
    const picked = pick(current);
    if (picked !== undefined) {
      return picked;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
};

export function getDesktopIpcCallContext(
  error: unknown,
): IDesktopIpcCallContext | undefined {
  return findInIpcErrorCauseChain(error, (item) => {
    const { ipcModule, ipcMethod } = item as Partial<IDesktopIpcCallContext>;
    return isIpcCallName(ipcModule) && isIpcCallName(ipcMethod)
      ? { ipcModule, ipcMethod }
      : undefined;
  });
}

// True when the error (or one it wraps) was rebuilt from an Electron IPC
// rejection, whether or not its call context survived.
export function isUnwrappedIpcError(error: unknown): boolean {
  return (
    findInIpcErrorCauseChain(error, (item) =>
      item instanceof UnwrappedIpcError ||
      (item as { name?: unknown }).name === 'UnwrappedIpcError'
        ? true
        : undefined,
    ) === true
  );
}

/**
 * Resolves a user-facing message from an arbitrary error.
 *
 * When `error.message` exactly matches an `ETranslations` enum value, returns
 * the localized text via `intl.formatMessage`. Otherwise returns the raw
 * message (or a sensible fallback). Safe to call on any platform — non-i18n
 * messages pass through unchanged.
 */
export function resolveErrorI18nMessage(
  err: unknown,
  intl?: IIntlMessageResolver,
): string {
  if (err === undefined || err === null) {
    return '';
  }
  const message = (err as { message?: unknown })?.message;
  const text = isString(message) ? message : String(err);

  if (intl) {
    return hasIntlMessage(intl, text) ? intl.formatMessage({ id: text }) : text;
  }

  const appLocaleIntl = getAppLocaleIntl();
  if (hasIntlMessage(appLocaleIntl, text)) {
    return appLocaleIntl.formatMessage({ id: text });
  }
  return text;
}
