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
        } catch (error) {
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
  response?: IHyperLiquidApiErrorResponse;
};

/**
 * Wrap HyperLiquid API responses and resolve i18n messages on errors.
 */
export async function convertHyperLiquidResponse<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const apiError = error as IHyperLiquidApiRequestError;
    const { response } = apiError;

    if (response?.status === 'err' && typeof response.response === 'string') {
      const originalMessage = response.response;
      const resolved = await hyperLiquidErrorResolver.resolveAsync(
        originalMessage,
      );

      if (
        resolved.localizedMessage &&
        resolved.localizedMessage !== originalMessage
      ) {
        apiError.message = resolved.localizedMessage;
      }
    }

    throw error;
  }
}
