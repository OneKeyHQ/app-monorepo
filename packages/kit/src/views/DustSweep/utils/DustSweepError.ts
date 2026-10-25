import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyErrorI18nInfo } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isKnownTranslationKey } from '@onekeyhq/shared/src/locale';
import type { IDustSweepReason } from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapErrorMessage } from '@onekeyhq/shared/types/swap/types';

export class DustSweepError extends OneKeyLocalError {
  reason: IDustSweepReason;
  // Display copy stays separate from internal diagnostics.
  providerErrorMessage?: string;
  localError?: ISwapErrorMessage;

  constructor(
    reason: IDustSweepReason,
    options?: {
      message?: string;
      providerErrorMessage?: string;
      localError?: ISwapErrorMessage;
    },
  ) {
    super(options?.message ?? options?.providerErrorMessage ?? reason);
    this.reason = reason;
    this.providerErrorMessage = options?.providerErrorMessage;
    this.localError = options?.localError;
  }

  static from(error: unknown): DustSweepError {
    if (error instanceof DustSweepError) return error;
    const providerErrorMessage = DustSweepError.getApiMessage(error);
    return new DustSweepError('unknown', {
      message: error instanceof Error ? error.message : undefined,
      providerErrorMessage,
      localError: providerErrorMessage
        ? undefined
        : DustSweepError.getLocalMessage(error),
    });
  }

  static getApiMessage(error: unknown) {
    if (!error || typeof error !== 'object') return undefined;
    const candidate = error as { className?: unknown; message?: unknown };
    // RPC preserves these fields, but not the error prototype.
    return candidate.className ===
      EOneKeyErrorClassNames.OneKeyServerApiError &&
      typeof candidate.message === 'string'
      ? candidate.message.trim() || undefined
      : undefined;
  }

  private static getLocalMessage(error: unknown) {
    if (!error || typeof error !== 'object') return undefined;
    const { key, info } = error as { key?: unknown; info?: unknown };
    if (typeof key !== 'string' || !isKnownTranslationKey(key))
      return undefined;
    const values: IOneKeyErrorI18nInfo = {};
    if (info && typeof info === 'object')
      for (const [name, value] of Object.entries(info)) {
        if (typeof value === 'string' || typeof value === 'number')
          values[name] = value;
      }
    return { key, values };
  }
}
