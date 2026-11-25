import { type IToastProps, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  extractHyperLiquidErrorMessage,
  hyperLiquidErrorResolver,
} from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';

import { ERROR_MESSAGES, ERROR_PATTERNS, TOAST_CONFIGS } from './config';
import { EErrorType } from './types';

import type { EActionType } from './types';

const ERROR_LOCALIZATION_TIMEOUT_MS = 300;

export interface IWithToastOptions<T = unknown> {
  asyncFn: () => Promise<T>;
  actionType?: EActionType;
  args?: any[];
  shouldShowSuccess?: (result: T) => boolean;
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

function formatDiagnosticError(error: unknown): string {
  try {
    return String(error instanceof Error ? error.message : error);
  } catch {
    return 'Unable to format error';
  }
}

async function resolveErrorToastTitle(
  error: unknown,
  errorMessage: string,
): Promise<string> {
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
                errorMessage: formatDiagnosticError(e),
              },
            });
          });
        break;
      }
      default:
        break;
    }
    return ERROR_MESSAGES[errorType]();
  }

  const rawResolved =
    rawErrorMessage !== errorMessage
      ? await hyperLiquidErrorResolver.resolveAsync(rawErrorMessage)
      : undefined;
  if (rawResolved?.i18nKey) {
    return rawResolved.localizedMessage;
  }
  const resolved = await hyperLiquidErrorResolver.resolveAsync(errorMessage);
  return resolved.localizedMessage || errorMessage;
}

export async function withToast<T>(options: IWithToastOptions<T>): Promise<T> {
  const { asyncFn, actionType, args } = options;
  if (!actionType) {
    return asyncFn();
  }
  const config = TOAST_CONFIGS[actionType];
  let loadingToast: ReturnType<typeof Toast.loading>;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  const showResult = (status: 'success' | 'error', props: IToastProps) => {
    if (loadingToast?.settle(status, props, { showAtFrontOnWeb: true })) {
      return;
    }
    loadingToast?.close();
    Toast[status](props);
  };

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
    if (options.shouldShowSuccess?.(result) === false) {
      loadingToast?.close();
      return result;
    }

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

    showResult('success', { title: successTitle, message: successMessage });

    return result;
  } catch (error) {
    if (loadingTimer) clearTimeout(loadingTimer);
    void Promise.resolve()
      .then(async () => {
        const fallbackTitle = extractErrorMessage(error);
        const title = await resolveBeforeTimeout(
          resolveErrorToastTitle(error, fallbackTitle),
          ERROR_LOCALIZATION_TIMEOUT_MS,
        );
        showResult('error', { title: title ?? fallbackTitle });
      })
      .catch((e: unknown) => {
        loadingToast?.close();
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'runtime_handle_error_failed',
          statusDetails: {
            errorMessage: formatDiagnosticError(e),
          },
        });
      });
    throw error;
  }
}
