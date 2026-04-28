import { isString } from 'lodash';

import { ETranslations } from '../../locale';

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

const IPC_WRAP_PATTERN =
  /^Error invoking remote method '([^']+)':\s*([\s\S]+)$/;

let eTranslationsKeySet: Set<string> | null = null;
const getETranslationsKeySet = () => {
  if (!eTranslationsKeySet) {
    eTranslationsKeySet = new Set(Object.values(ETranslations));
  }
  return eTranslationsKeySet;
};

const isETranslationsKey = (value: unknown): value is ETranslations =>
  isString(value) && getETranslationsKeySet().has(value);

type IUnwrappedPayload = {
  message: string;
  code?: number;
  data?: unknown;
};

const parseInnerPayload = (tail: string): IUnwrappedPayload => {
  const trimmed = tail.trim();
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
  intl?: Pick<IntlShape, 'formatMessage'>,
): string {
  if (err === undefined || err === null) {
    return '';
  }
  const message = (err as { message?: unknown })?.message;
  const text = isString(message) ? message : String(err);
  if (isETranslationsKey(text)) {
    if (intl) {
      return intl.formatMessage({ id: text });
    }
    // Lazy require keeps this module free of `react-intl` at load time so
    // tests that stub `react-intl` (without providing `createIntl`) can still
    // import code paths that reach this file.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const appLocaleModule: typeof import('../../locale/appLocale') = require('../../locale/appLocale');
    return appLocaleModule.appLocale.intl.formatMessage({ id: text });
  }
  return text;
}
