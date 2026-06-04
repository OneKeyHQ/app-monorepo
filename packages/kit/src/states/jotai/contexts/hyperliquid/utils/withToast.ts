import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  extractHyperLiquidErrorMessage,
  hyperLiquidErrorResolver,
} from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';

import { ERROR_MESSAGES, ERROR_PATTERNS, TOAST_CONFIGS } from './config';
import { EErrorType } from './types';

import type { EActionType } from './types';

export interface IWithToastOptions<T = unknown> {
  asyncFn: () => Promise<T>;
  actionType?: EActionType;
  args?: any[];
}

function identifyError(errorMessage: string): EErrorType | null {
  for (const [errorType, keywords] of Object.entries(ERROR_PATTERNS)) {
    // Require all keywords to match (reduces false positives), case-insensitive
    const lowerMessage = errorMessage.toLowerCase();
    if (
      keywords.every((keyword) => lowerMessage.includes(keyword.toLowerCase()))
    ) {
      return errorType as EErrorType;
    }
  }
  return null;
}

function extractRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

function extractErrorMessage(error: unknown): string {
  const hyperLiquidMessage = extractHyperLiquidErrorMessage(error);
  if (hyperLiquidMessage) return hyperLiquidMessage;

  return extractRawErrorMessage(error);
}

async function handleError(error: unknown): Promise<void> {
  const errorMessage = extractErrorMessage(error);
  const rawErrorMessage = extractRawErrorMessage(error);
  const errorType =
    identifyError(errorMessage) ?? identifyError(rawErrorMessage);

  if (errorType) {
    switch (errorType) {
      case EErrorType.INVALID_AGENT: {
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'runtime_invalid_agent_error',
          statusDetails: {
            errorMessage,
          },
        });
        // Pass isEnableTradingTrigger to trigger full agent re-creation if needed
        void backgroundApiProxy.serviceHyperliquid
          .checkPerpsAccountStatus({ isEnableTradingTrigger: true })
          .catch((e: unknown) => {
            defaultLogger.perp.agentLifeCycle.trackReason({
              reason: 'runtime_invalid_agent_recovery_failed',
              statusDetails: {
                errorMessage: e instanceof Error ? e.message : String(e),
              },
            });
          });
        break;
      }
      default:
        break;
    }
  }

  const rawResolved =
    rawErrorMessage !== errorMessage
      ? await hyperLiquidErrorResolver.resolveAsync(rawErrorMessage)
      : undefined;
  const extractedResolved =
    !rawResolved?.i18nKey && !errorType
      ? await hyperLiquidErrorResolver.resolveAsync(errorMessage)
      : undefined;

  let friendlyMessage = errorMessage;
  if (errorType) {
    friendlyMessage = ERROR_MESSAGES[errorType]();
  } else if (rawResolved?.i18nKey) {
    friendlyMessage = rawResolved.localizedMessage;
  } else if (extractedResolved?.localizedMessage) {
    friendlyMessage = extractedResolved.localizedMessage;
  }
  Toast.error({ title: friendlyMessage });
}

export async function withToast<T>(options: IWithToastOptions<T>): Promise<T> {
  const { asyncFn, actionType, args } = options;
  if (!actionType) {
    return asyncFn();
  }
  const config = TOAST_CONFIGS[actionType];
  let loadingToast: { close: () => void } | undefined;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;

  if (config?.loading) {
    const loadingText =
      typeof config.loading === 'function'
        ? config.loading(...(args || []))
        : config.loading;

    loadingTimer = setTimeout(() => {
      loadingToast = Toast.loading({ title: loadingText, duration: Infinity });
    }, 300);
  }

  try {
    const result = await asyncFn();

    if (loadingTimer) clearTimeout(loadingTimer);
    if (loadingToast) loadingToast.close();

    const successTitle =
      typeof config.successTitle === 'function'
        ? config.successTitle(...(args || []))
        : config.successTitle;

    let successMessage: string | undefined;
    if (config.successMessage) {
      successMessage =
        typeof config.successMessage === 'function'
          ? config.successMessage(...(args || []))
          : config.successMessage;
    }

    Toast.success({ title: successTitle, message: successMessage });

    return result;
  } catch (error) {
    if (loadingTimer) clearTimeout(loadingTimer);
    if (loadingToast) loadingToast.close();

    void handleError(error).catch((e: unknown) => {
      defaultLogger.perp.agentLifeCycle.trackReason({
        reason: 'runtime_handle_error_failed',
        statusDetails: {
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
    });
    throw error;
  }
}
