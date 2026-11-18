import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IIdentityExitFlowResult,
  IIdentityExitIntent,
  IIdentityExitPlan,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import { scrubSensitiveErrorMessageText } from '../../views/Prime/components/oneKeyIdLoginToastUtils';

import {
  executeIdentityExitPlan,
  useShowOneKeyIdLogoutDialog,
} from './OneKeyIdLogoutDialog';

import type { IntlShape } from 'react-intl';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

export type IRunIdentityExitOptions = {
  confirmButtonTestID?: string;
  /** Only applies to environment switches in developer settings. */
  skipConfirmation?: boolean;
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
  return String(error || 'Identity exit failed.');
}

function logIdentityExitError(label: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // Keep the original Error object so the browser console preserves its stack.
  // eslint-disable-next-line no-console
  console.error(`[IdentityExit] ${label}`, error);
}

function showBlockedMessage(intl: IntlShape) {
  Toast.error({
    title: intl.formatMessage({
      id: ETranslations.global_unknown_error_retry_message,
    }),
  });
}

// A deliberate user cancel (e.g. closing the OAuth popup of a post-exit
// continuation) must not surface as an error, and an error the global auto
// toast already showed must not get a second generic toast.
function showBlockedMessageForError(intl: IntlShape, error: unknown) {
  if (
    errorToastUtils.isUserCancelStyleError(error) ||
    errorToastUtils.wasAutoToastShown(error)
  ) {
    return;
  }
  showBlockedMessage(intl);
}

export function useIdentityExitFlow() {
  const intl = useIntl();
  const showIdentityExitDialog = useShowOneKeyIdLogoutDialog();
  const [devSettings] = useDevSettingsPersistAtom();

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
        if (plan.status === 'completed') {
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason:
              options?.analyticsReason ||
              `identityExit:${intent.type}:${intent.scene}:alreadyCompleted`,
          });
          try {
            await options?.onCompletedReceipt?.(plan.receipt);
          } catch (error) {
            logIdentityExitError('post-receipt continuation failed', error);
            const message = getErrorMessage(error);
            defaultLogger.prime.subscription.onekeyIdLogout({
              reason: `identityExit: post-receipt continuation failed: ${scrubSensitiveErrorMessageText(
                message,
              )}`,
            });
            showBlockedMessageForError(intl, error);
          }
          return { status: 'completed' };
        }
        if (plan.status === 'blocked') {
          logIdentityExitError('prepare blocked', plan);
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: `identityExit: prepare blocked: ${scrubSensitiveErrorMessageText(
              plan.message,
            )}`,
          });
          showBlockedMessage(intl);
          return { status: 'blocked', message: plan.message };
        }

        await options?.beforePresentReadyPlan?.(plan);
        let exitResult: Awaited<ReturnType<typeof showIdentityExitDialog>>;
        if (
          devSettings.enabled &&
          intent.type === 'switchEnvironment' &&
          options?.skipConfirmation &&
          plan.confirmation.type === 'normal'
        ) {
          await options.beforeExecute?.();
          const receipt = await executeIdentityExitPlan(plan);
          if (receipt.status === 'cancelled') {
            return { status: 'cancelled' };
          }
          exitResult =
            receipt.status === 'completed'
              ? { status: 'completed', receipt }
              : receipt;
        } else {
          exitResult = await showIdentityExitDialog({
            plan,
            confirmButtonTestID: options?.confirmButtonTestID,
            beforeExecute: options?.beforeExecute,
          });
        }
        if (exitResult.status === 'cancelled') {
          return { status: 'cancelled' };
        }
        if (exitResult.status === 'blocked') {
          logIdentityExitError('execute blocked', exitResult);
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: `identityExit: execute blocked: ${scrubSensitiveErrorMessageText(
              exitResult.message,
            )}`,
          });
          showBlockedMessage(intl);
          return { status: 'blocked', message: exitResult.message };
        }

        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            options?.analyticsReason ||
            `identityExit:${intent.type}:${intent.scene}`,
        });
        try {
          await options?.onCompletedReceipt?.(exitResult.receipt);
        } catch (error) {
          logIdentityExitError('post-receipt continuation failed', error);
          const message = getErrorMessage(error);
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: `identityExit: post-receipt continuation failed: ${scrubSensitiveErrorMessageText(
              message,
            )}`,
          });
          showBlockedMessageForError(intl, error);
        }
        return { status: 'completed' };
      } catch (error) {
        logIdentityExitError('flow failed', error);
        const message = getErrorMessage(error);
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: `identityExit: flow failed: ${scrubSensitiveErrorMessageText(
            message,
          )}`,
        });
        showBlockedMessageForError(intl, error);
        return { status: 'blocked', message };
      }
    },
    [devSettings.enabled, intl, showIdentityExitDialog],
  );

  return { run };
}
