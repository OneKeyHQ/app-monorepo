import { Toast } from '@onekeyhq/components';
import { perpsSelectedAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { ERROR_MESSAGES, ERROR_PATTERNS, TOAST_CONFIGS } from './config';
import { EErrorType } from './types';

import type { EActionType } from './types';

export interface IWithToastOptions<T = unknown> {
  asyncFn: () => Promise<T>;
  actionType: EActionType;
  args?: any[];
}

function identifyError(errorMessage: string): EErrorType | null {
  for (const [errorType, keywords] of Object.entries(ERROR_PATTERNS)) {
    if (keywords.some((keyword) => errorMessage.includes(keyword))) {
      return errorType as EErrorType;
    }
  }
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

async function handleError(error: unknown): Promise<void> {
  const errorMessage = extractErrorMessage(error);
  const errorType = identifyError(errorMessage);

  if (errorType) {
    switch (errorType) {
      case EErrorType.INVALID_AGENT: {
        const accountStatus = await perpsSelectedAccountStatusAtom.get();
        void perpsSelectedAccountStatusAtom.set({
          ...accountStatus,
          canTrade: false,
          details: {
            ...accountStatus.details,
            agentOk: false,
          },
        });
        break;
      }
      default:
        break;
    }
  }

  const friendlyMessage = errorType ? ERROR_MESSAGES[errorType] : errorMessage;
  Toast.error({ title: friendlyMessage });
}

export async function withToast<T>(options: IWithToastOptions<T>): Promise<T> {
  const { asyncFn, actionType, args } = options;
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

    void handleError(error);
    throw error;
  }
}
