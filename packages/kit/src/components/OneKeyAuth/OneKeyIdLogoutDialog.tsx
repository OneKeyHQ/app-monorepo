import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOAuthSocialLoginProviderName } from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import type {
  IIdentityExitPlan,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import {
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION,
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
} from './oneKeyIdLogoutConsts';

import type { IntlShape } from 'react-intl';

type IReadyIdentityExitPlan = Extract<IIdentityExitPlan, { status: 'ready' }>;

export type IOneKeyIdLogoutDialogResult =
  | {
      status: 'completed';
      receipt: Extract<IIdentityExitReceipt, { status: 'completed' }>;
    }
  | {
      status: 'cancelled';
      reason: 'dismissed' | 'alreadyShowing';
    }
  | {
      status: 'blocked';
      message: string;
    };

type IOneKeyIdLogoutDialogOptions = {
  plan: IReadyIdentityExitPlan;
  confirmButtonTestID?: string;
  beforeExecute?: () => void | Promise<void>;
};

type IOneKeyIdLogoutDialogContentConfig = {
  icon: 'ErrorOutline' | 'InfoCircleOutline';
  tone?: 'destructive';
  title: string;
  description: string;
  confirmText: string;
};

function getOneKeyIdLogoutDialogContent({
  intl,
  plan,
}: {
  intl: IntlShape;
  plan: IReadyIdentityExitPlan;
}): IOneKeyIdLogoutDialogContentConfig {
  const { presentation } = plan;
  if (presentation.type === 'recoverMalformedKeyless') {
    const nextProviderName = presentation.nextProvider
      ? getOAuthSocialLoginProviderName(presentation.nextProvider)
      : undefined;
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      // TODO: i18n
      title: 'Remove Unavailable Keyless Wallet?',
      // TODO: i18n
      description: `The local Keyless wallet data cannot be read correctly. ${
        nextProviderName
          ? `To continue with ${nextProviderName}, first remove this Keyless wallet from this device.`
          : 'Remove this Keyless wallet from this device to continue.'
      } You can restore it later with its original account and PIN.${
        presentation.oneKeyIdWillBeLoggedOut
          ? ' The OneKey ID session backed by this Keyless wallet will also be logged out.'
          : ''
      }`,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }
  if (presentation.type === 'switchOAuthProvider') {
    const currentProviderName = getOAuthSocialLoginProviderName(
      presentation.currentProvider,
    );
    const nextProviderName = getOAuthSocialLoginProviderName(
      presentation.nextProvider,
    );
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      // TODO: i18n (use a complete message with provider placeholders)
      title: `Switch to ${nextProviderName} Sign-In?`,
      // TODO: i18n (use a complete message with provider placeholders)
      description: `You're currently using ${currentProviderName} Keyless. Continuing with ${nextProviderName} will log out and remove this Keyless wallet from this device. To restore it, you'll need access to your ${currentProviderName} account and your PIN.`,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  if (presentation.type === 'linkedOneKeyIdAndKeyless') {
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
      description: `${ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION}\n\n${intl.formatMessage(
        { id: ETranslations.log_out_wallet_desc },
      )}`,
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  if (presentation.type === 'keylessOnly') {
    return {
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({ id: ETranslations.log_out_wallet }),
      description: intl.formatMessage({
        id: ETranslations.log_out_wallet_desc,
      }),
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  return {
    icon: 'InfoCircleOutline',
    title: intl.formatMessage({ id: ETranslations.prime_onekeyid_log_out }),
    description: intl.formatMessage({
      id: ETranslations.prime_onekeyid_log_out_description,
    }),
    confirmText: intl.formatMessage({ id: ETranslations.prime_log_out }),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  // TODO: i18n
  return String(error || 'Identity exit failed.');
}

function OneKeyIdLogoutDialogContent({
  plan,
  confirmText,
  confirmButtonTestID,
  beforeExecute,
  onExecutionStarted,
  onCancel,
  onResult,
}: {
  plan: IReadyIdentityExitPlan;
  confirmText: string;
  confirmButtonTestID?: string;
  beforeExecute?: () => void | Promise<void>;
  onExecutionStarted: () => void;
  onCancel: () => void;
  onResult: (
    result: Exclude<IOneKeyIdLogoutDialogResult, { status: 'cancelled' }>,
    close: (extra?: { flag?: string }) => Promise<void> | void,
  ) => Promise<void>;
}) {
  const intl = useIntl();
  const [acknowledged, setAcknowledged] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const executionStartedRef = useRef(false);
  const requiresAcknowledgement =
    plan.confirmation.type === 'keylessRemovalAcknowledgement';

  const handleChange = useCallback((checked: ICheckedState) => {
    setAcknowledged(Boolean(checked));
  }, []);

  return (
    <>
      {requiresAcknowledgement ? (
        <Checkbox
          testID="account-manager-is-confirm-disabled-checkbox"
          value={acknowledged}
          disabled={isExecuting}
          onChange={handleChange}
          label={intl.formatMessage({
            id: ETranslations.log_out_wallet_checkbox_label,
          })}
        />
      ) : null}
      <Dialog.Footer
        showCancelButton
        onConfirmText={confirmText}
        cancelButtonProps={{ disabled: isExecuting }}
        confirmButtonProps={{
          disabled: isExecuting || (requiresAcknowledgement && !acknowledged),
          testID: confirmButtonTestID,
          ...(requiresAcknowledgement
            ? { variant: 'destructive' as const }
            : {}),
        }}
        onCancel={() => {
          if (!executionStartedRef.current) {
            onCancel();
          }
        }}
        onConfirm={async ({ preventClose, close }) => {
          preventClose();
          if (executionStartedRef.current) {
            return;
          }
          executionStartedRef.current = true;
          onExecutionStarted();
          setIsExecuting(true);
          try {
            await beforeExecute?.();
            const receipt =
              await backgroundApiProxy.serviceIdentityExit.executeIdentityExit({
                planId: plan.planId,
                acknowledgement: requiresAcknowledgement
                  ? 'keylessWalletRemoval'
                  : undefined,
              });
            if (receipt.status === 'completed') {
              await onResult({ status: 'completed', receipt }, close);
              return;
            }
            if (receipt.status === 'cancelled') {
              onCancel();
              return;
            }
            await onResult(
              { status: 'blocked', message: receipt.message },
              close,
            );
          } catch (error) {
            await onResult(
              { status: 'blocked', message: getErrorMessage(error) },
              close,
            );
          }
        }}
      />
    </>
  );
}

let isOneKeyIdLogoutDialogShowing = false;

export function useShowOneKeyIdLogoutDialog() {
  const intl = useIntl();

  return useCallback(
    async ({
      plan,
      confirmButtonTestID,
      beforeExecute,
    }: IOneKeyIdLogoutDialogOptions): Promise<IOneKeyIdLogoutDialogResult> => {
      if (isOneKeyIdLogoutDialogShowing) {
        return { status: 'cancelled', reason: 'alreadyShowing' };
      }
      isOneKeyIdLogoutDialogShowing = true;
      const content = getOneKeyIdLogoutDialogContent({ intl, plan });

      try {
        return await new Promise<IOneKeyIdLogoutDialogResult>((resolve) => {
          let isSettled = false;
          let pendingBusinessResult:
            | Exclude<IOneKeyIdLogoutDialogResult, { status: 'cancelled' }>
            | undefined;
          let executionStarted = false;
          const dialogInstanceRef: {
            current?: ReturnType<typeof Dialog.show>;
          } = {};
          const settleOnce = (result: IOneKeyIdLogoutDialogResult) => {
            if (!isSettled) {
              isSettled = true;
              resolve(result);
            }
          };
          const closeWithResult = async (
            result: Exclude<
              IOneKeyIdLogoutDialogResult,
              { status: 'cancelled' }
            >,
            close: (extra?: { flag?: string }) => Promise<void> | void,
          ) => {
            pendingBusinessResult = result;
            try {
              await close({ flag: result.status });
            } finally {
              settleOnce(result);
            }
          };
          const cancelAndClose = async () => {
            if (pendingBusinessResult) {
              return;
            }
            try {
              await dialogInstanceRef.current?.close({ flag: 'cancelled' });
            } finally {
              settleOnce({ status: 'cancelled', reason: 'dismissed' });
            }
          };

          const dialogInstance = Dialog.show({
            icon: content.icon,
            tone: content.tone,
            title: content.title,
            description: content.description,
            showExitButton: false,
            dismissOnOverlayPress: false,
            disableDrag: true,
            disableSystemClose: true,
            onClose: () => {
              if (!executionStarted || pendingBusinessResult) {
                isOneKeyIdLogoutDialogShowing = false;
              }
              if (!pendingBusinessResult && !executionStarted) {
                settleOnce({ status: 'cancelled', reason: 'dismissed' });
              }
            },
            renderContent: (
              <OneKeyIdLogoutDialogContent
                plan={plan}
                confirmText={content.confirmText}
                confirmButtonTestID={confirmButtonTestID}
                beforeExecute={beforeExecute}
                onExecutionStarted={() => {
                  executionStarted = true;
                }}
                onCancel={() => void cancelAndClose()}
                onResult={closeWithResult}
              />
            ),
          });
          dialogInstanceRef.current = dialogInstance;
        });
      } finally {
        isOneKeyIdLogoutDialogShowing = false;
      }
    },
    [intl],
  );
}
