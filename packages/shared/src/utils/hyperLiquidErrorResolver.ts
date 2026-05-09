/**
 * HyperLiquid API error message i18n resolver.
 *
 * Responsibilities:
 * 1. Convert server-supplied English errors into localized messages via locale config.
 * 2. Support both exact and regex matching modes.
 * 3. Replace {{variable}} placeholders with extracted values.
 * 4. Fall back to locale data loaded from local storage when needed.
 */

import type { IHyperLiquidErrorLocaleItem } from '@onekeyhq/shared/types/hyperliquid/types';

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

type IResolvedError = {
  i18nKey?: string;
  rawMessage: string;
  localizedMessage: string;
  variables?: Record<string, string>;
};

type ILocaleDataProvider = () => Promise<
  IHyperLiquidErrorLocaleItem[] | undefined
>;

class HyperLiquidErrorResolver {
  private locales: IHyperLiquidErrorLocaleItem[] = [];

  private compiledMatchers = new Map<string, RegExp | string>();

  private localeProvider?: ILocaleDataProvider;

  /**
   * Register the locale data provider used for fallback lookups.
   */
  setLocaleProvider(provider: ILocaleDataProvider): void {
    this.localeProvider = provider;
  }

  /**
   * Update the in-memory locale data.
   */
  updateLocales(locales: IHyperLiquidErrorLocaleItem[] | undefined): void {
    this.locales = locales || [];
    this.compileMatchers();
  }

  /**
   * Precompile all matchers to improve performance.
   */
  private compileMatchers(): void {
    this.compiledMatchers.clear();

    this.locales.forEach((item) => {
      const key = item.i18nKey;
      const { matcher } = item;

      if (matcher.type === 'regex' && matcher.pattern) {
        try {
          this.compiledMatchers.set(key, new RegExp(matcher.pattern));
        } catch (_error) {
          console.error(
            `[HyperLiquidErrorResolver] Invalid regex pattern for ${key}:`,
            matcher.pattern,
          );
        }
      } else if (matcher.type === 'exact' && matcher.value) {
        this.compiledMatchers.set(key, matcher.value);
      }
    });
  }

  /**
   * Resolve an error message synchronously using in-memory locale data.
   */
  resolve(rawMessage: string): IResolvedError {
    if (!rawMessage) {
      return { rawMessage: '', localizedMessage: '' };
    }

    if (this.locales.length === 0) {
      return { rawMessage, localizedMessage: rawMessage };
    }

    return this.matchAndResolve(rawMessage);
  }

  /**
   * Resolve an error message asynchronously with a fallback to local storage.
   */
  async resolveAsync(rawMessage: string): Promise<IResolvedError> {
    if (!rawMessage) {
      return { rawMessage: '', localizedMessage: '' };
    }

    // 1. Try the in-memory data first.
    if (this.locales.length > 0) {
      return this.matchAndResolve(rawMessage);
    }

    // 2. Fall back to locale data loaded from local storage.
    if (this.localeProvider) {
      try {
        const locales = await this.localeProvider();
        if (locales && locales.length > 0) {
          this.updateLocales(locales);
          return this.matchAndResolve(rawMessage);
        }
      } catch (error) {
        console.error(
          '[HyperLiquidErrorResolver] Failed to load locales from provider:',
          error,
        );
      }
    }

    // 3. No locale data available; return the original message.
    return { rawMessage, localizedMessage: rawMessage };
  }

  /**
   * Core matching and resolution logic.
   */
  private matchAndResolve(rawMessage: string): IResolvedError {
    for (const item of this.locales) {
      const compiled = this.compiledMatchers.get(item.i18nKey);
      // eslint-disable-next-line no-continue
      if (!compiled) continue;

      const variables = this.extractVariables(compiled, rawMessage);
      if (variables !== undefined) {
        return {
          i18nKey: item.i18nKey,
          rawMessage: this.fillTemplate(item.rawMessage, variables),
          localizedMessage: this.fillTemplate(item.localizedMessage, variables),
          variables,
        };
      }
    }

    // No matching rule found; return the original message.
    return { rawMessage, localizedMessage: rawMessage };
  }

  /**
   * Extract variables for both exact and regex matchers.
   */
  private extractVariables(
    compiled: RegExp | string,
    raw: string,
  ): Record<string, string> | undefined {
    // Exact match: return an empty object only on a full match.
    if (typeof compiled === 'string') {
      return compiled === raw ? {} : undefined;
    }

    // Regex match: use named capture groups to extract variables.
    const match = compiled.exec(raw);
    if (!match) return undefined;

    return match.groups || {};
  }

  /**
   * Fill template placeholders such as {{variable}}.
   */
  private fillTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(
      PLACEHOLDER_REGEX,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
      (_, key) => variables[key] ?? `{{${key}}}`,
    );
  }
}

// Global singleton instance.
export const hyperLiquidErrorResolver = new HyperLiquidErrorResolver();

type IHyperLiquidApiErrorResponse = {
  status: 'err';
  response: unknown;
};

type IHyperLiquidApiRequestError = Error & {
  response?: IHyperLiquidApiErrorResponse | { data?: unknown };
  cause?: unknown;
};

const MAX_ERROR_EXTRACTION_DEPTH = 8;

function normalizeKnownErrorPayload(
  payload: unknown,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  if (depth > MAX_ERROR_EXTRACTION_DEPTH) {
    return undefined;
  }

  if (payload === null || payload === undefined) {
    return undefined;
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed || undefined;
  }

  if (typeof payload !== 'object') {
    return String(payload);
  }

  if (seen.has(payload)) {
    return undefined;
  }
  seen.add(payload);

  const data = payload as Record<string, unknown>;
  if (data.status === 'err' && data.response !== undefined) {
    return normalizeKnownErrorPayload(data.response, seen, depth + 1);
  }

  const response = data.response;
  if (response !== undefined) {
    return normalizeKnownErrorPayload(response, seen, depth + 1);
  }

  for (const key of ['message', 'error', 'details', 'detail']) {
    const value = data[key];
    const normalized = normalizeKnownErrorPayload(value, seen, depth + 1);
    if (normalized) {
      return normalized;
    }
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return undefined;
  }
}

function extractHyperLiquidPayload(
  payload: unknown,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  if (depth > MAX_ERROR_EXTRACTION_DEPTH) {
    return undefined;
  }

  if (payload === null || payload === undefined) {
    return undefined;
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return (
      parseJsonLikeErrorMessage(trimmed, seen, depth + 1) ??
      extractFromWrappedMessage(trimmed, seen, depth + 1)
    );
  }

  if (typeof payload !== 'object') {
    return undefined;
  }

  if (seen.has(payload)) {
    return undefined;
  }
  seen.add(payload);

  const data = payload as Record<string, unknown>;
  if (data.status === 'err' && data.response !== undefined) {
    return normalizeKnownErrorPayload(data.response, seen, depth + 1);
  }

  const nestedData = data.data;
  if (nestedData !== undefined) {
    return extractHyperLiquidPayload(nestedData, seen, depth + 1);
  }

  return undefined;
}

function extractFromResponseContainer(
  response: unknown,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  if (depth > MAX_ERROR_EXTRACTION_DEPTH) {
    return undefined;
  }

  if (response === null || response === undefined) {
    return undefined;
  }

  if (typeof response === 'string') {
    return extractHyperLiquidPayload(response, seen, depth + 1);
  }

  if (typeof response !== 'object') {
    return undefined;
  }

  if (seen.has(response)) {
    return undefined;
  }
  seen.add(response);

  const data = response as Record<string, unknown>;
  if (data.status === 'err' && data.response !== undefined) {
    return normalizeKnownErrorPayload(data.response, seen, depth + 1);
  }

  if (
    data.response !== undefined &&
    data.status !== 'ok' &&
    typeof data.status !== 'number'
  ) {
    return normalizeKnownErrorPayload(data.response, seen, depth + 1);
  }

  return extractHyperLiquidPayload(data.data, seen, depth + 1);
}

function parseJsonLikeErrorMessage(
  message: string,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  try {
    const parsed = JSON.parse(message) as unknown;
    const normalized = extractHyperLiquidPayload(parsed, seen, depth + 1);
    if (normalized) {
      return normalized;
    }
  } catch {
    // ignore and try embedded JSON below
  }

  const responseMatch = /"response"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(message);
  if (responseMatch?.[1] && /"status"\s*:\s*"err"/.test(message)) {
    try {
      return JSON.parse(`"${responseMatch[1]}"`) as string;
    } catch {
      return responseMatch[1];
    }
  }

  return undefined;
}

function isHyperLiquidWrapperNoise(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    !value ||
    /^hyperliquid api error \d+/.test(lower) ||
    lower === 'error' ||
    lower === 'axioserror' ||
    lower.startsWith('err_') ||
    lower.startsWith('request failed with status code') ||
    /^\d{3}$/.test(lower) ||
    [
      'bad request',
      'unprocessable entity',
      'internal server error',
      'not found',
    ].includes(lower)
  );
}

function extractFromWrappedMessage(
  message: string,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  const jsonMessage = parseJsonLikeErrorMessage(message, seen, depth + 1);
  if (jsonMessage) {
    return jsonMessage;
  }

  const prefixMatch = /^Hyperliquid API error \d+:\s*(.+)$/i.exec(message);
  if (!prefixMatch?.[1]) {
    const apiRequestErrorMatch =
      /(?:^|:\s*)ApiRequestError:\s*(?:Order\s+\d+:\s*)?(.+)$/i.exec(message);
    return apiRequestErrorMatch?.[1]
      ? normalizeExtractedBusinessMessage(apiRequestErrorMatch[1])
      : undefined;
  }

  const parts = prefixMatch[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const lastNoiseIndex = parts.reduce(
    (index, part, partIndex) =>
      isHyperLiquidWrapperNoise(part) ? partIndex : index,
    -1,
  );
  const businessParts = parts
    .slice(lastNoiseIndex + 1)
    .filter((part) => !isHyperLiquidWrapperNoise(part));

  if (businessParts.length > 0) {
    return businessParts.join(', ');
  }

  return undefined;
}

function normalizeExtractedBusinessMessage(
  message: string,
): string | undefined {
  const normalized = message.replace(/\s+asset=\S+\s*$/i, '').trim();
  return normalized || undefined;
}

/**
 * Extract the user-facing HyperLiquid business error from SDK errors,
 * axios errors, API response objects, or wrapped strings.
 */
export function extractHyperLiquidErrorMessage(
  error: unknown,
): string | undefined {
  return extractHyperLiquidErrorMessageInternal(error, new WeakSet(), 0);
}

function extractHyperLiquidErrorMessageInternal(
  error: unknown,
  seen: WeakSet<object>,
  depth: number,
): string | undefined {
  if (depth > MAX_ERROR_EXTRACTION_DEPTH) {
    return undefined;
  }

  if (error === null || error === undefined) {
    return undefined;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    return extractFromWrappedMessage(trimmed, seen, depth + 1);
  }

  if (typeof error !== 'object') {
    return undefined;
  }

  if (seen.has(error)) {
    return undefined;
  }
  seen.add(error);

  const errorObject = error as IHyperLiquidApiRequestError;
  const response = errorObject.response;

  const responseMessage = extractFromResponseContainer(
    response,
    seen,
    depth + 1,
  );
  if (responseMessage) {
    return responseMessage;
  }

  const causeMessage = extractHyperLiquidErrorMessageInternal(
    errorObject.cause,
    seen,
    depth + 1,
  );
  if (causeMessage) {
    return causeMessage;
  }

  return extractHyperLiquidErrorMessageInternal(
    errorObject.message,
    seen,
    depth + 1,
  );
}

/**
 * Wrap HyperLiquid API responses and resolve i18n messages on errors.
 */
export async function convertHyperLiquidResponse<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Unwrap AbstractWalletError from @nktkas/hyperliquid SDK.
    // The SDK wraps all signing errors in AbstractWalletError with the
    // original error preserved in `cause`. Rethrowing `cause` restores
    // OneKey's own error types (hardware errors, user cancel, etc.)
    // so that existing i18n and toast handling works correctly.
    const walletError = error as { name?: string; cause?: Error };
    if (
      walletError.name === 'AbstractWalletError' &&
      walletError.cause instanceof Error
    ) {
      throw walletError.cause;
    }

    const apiError = error as IHyperLiquidApiRequestError;
    const originalMessage = extractHyperLiquidErrorMessage(apiError);
    if (originalMessage) {
      const resolved =
        await hyperLiquidErrorResolver.resolveAsync(originalMessage);

      if (
        resolved.localizedMessage &&
        resolved.localizedMessage !== apiError.message
      ) {
        apiError.message = resolved.localizedMessage;
      }
    }

    throw error;
  }
}
