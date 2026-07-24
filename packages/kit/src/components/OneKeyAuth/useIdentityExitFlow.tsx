import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IIdentityExitFlowResult,
  IIdentityExitIntent,
  IIdentityExitPlan,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import { useShowOneKeyIdLogoutDialog } from './OneKeyIdLogoutDialog';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

export type IRunIdentityExitOptions = {
  confirmButtonTestID?: string;
  analyticsReason?: string;
  beforeExecute?: () => void | Promise<void>;
  beforePresentReadyPlan?: (
    plan: IReadyIdentityExitPlan,
  ) => void | Promise<void>;
  onCompletedReceipt?: (
    receipt: Extract<IIdentityExitReceipt, { status: 'completed' }>,
  ) => void | Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  // TODO: i18n
  return String(error || 'Identity exit failed.');
}

function showBlockedMessage(message: string) {
  Toast.error({
    // TODO: i18n
    title: 'Unable to continue',
    message,
  });
}

export function useIdentityExitFlow() {
  const showIdentityExitDialog = useShowOneKeyIdLogoutDialog();

  const run = useCallback(
    async (
      intent: IIdentityExitIntent,
      options?: IRunIdentityExitOptions,
    ): Promise<IIdentityExitFlowResult> => {
      try {
        const plan =
          await backgroundApiProxy.serviceIdentityExit.prepareIdentityExit(
            intent,
          );
        if (plan.status === 'blocked') {
          showBlockedMessage(plan.message);
          return { status: 'blocked', message: plan.message };
        }

        await options?.beforePresentReadyPlan?.(plan);
        const dialogResult = await showIdentityExitDialog({
          plan,
          confirmButtonTestID: options?.confirmButtonTestID,
          beforeExecute: options?.beforeExecute,
        });
        if (dialogResult.status === 'cancelled') {
          return { status: 'cancelled' };
        }
        if (dialogResult.status === 'blocked') {
          showBlockedMessage(dialogResult.message);
          return { status: 'blocked', message: dialogResult.message };
        }

        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            options?.analyticsReason ||
            `identityExit:${intent.type}:${intent.scene}`,
        });
        try {
          await options?.onCompletedReceipt?.(dialogResult.receipt);
        } catch (error) {
          const message = getErrorMessage(error);
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: `identityExit: post-receipt continuation failed: ${message}`,
          });
          showBlockedMessage(message);
        }
        return { status: 'completed' };
      } catch (error) {
        const message = getErrorMessage(error);
        showBlockedMessage(message);
        return { status: 'blocked', message };
      }
    },
    [showIdentityExitDialog],
  );

  return { run };
}
