import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { classifyOneKeyIdLogoutKeylessHandling } from './oneKeyIdLogoutClassification';
import {
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION,
  ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
} from './oneKeyIdLogoutConsts';
import { useOneKeyAuthMethods } from './useOneKeyAuth';

import type { IntlShape } from 'react-intl';

export enum EOneKeyIdLogoutDialogSource {
  OneKeyId = 'oneKeyId',
  KeylessWallet = 'keylessWallet',
}

type IOneKeyIdLogoutDialogOptions = {
  source: EOneKeyIdLogoutDialogSource;
  config?: IAccountSelectorContextData;
  keylessWallet?: IDBWallet;
  isOneKeyIdLoggedIn?: boolean;
  isRemoveToMocked?: boolean;
  reason?: string;
  onBeforeLogout?: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
  onConfirmRemove?: () => void;
  confirmButtonTestID?: string;
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
  source,
  keylessWallet,
  shouldLinkKeylessOneKeyIdLogout,
}: {
  intl: IntlShape;
  source: EOneKeyIdLogoutDialogSource;
  keylessWallet?: IDBWallet;
  shouldLinkKeylessOneKeyIdLogout: boolean;
}): IOneKeyIdLogoutDialogContentConfig {
  const hasKeylessWallet = Boolean(keylessWallet);

  if (shouldLinkKeylessOneKeyIdLogout) {
    return {
      icon: 'ErrorOutline' as const,
      tone: 'destructive' as const,
      title: ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_TITLE,
      description: `${ONEKEY_ID_ASSOCIATED_KEYLESS_LOGOUT_DESCRIPTION}\n\n${intl.formatMessage(
        {
          id: ETranslations.log_out_wallet_desc,
        },
      )}`,
      confirmText:
        source === EOneKeyIdLogoutDialogSource.KeylessWallet
          ? intl.formatMessage({ id: ETranslations.global_logout })
          : intl.formatMessage({ id: ETranslations.prime_log_out }),
    };
  }

  if (hasKeylessWallet) {
    return {
      icon: 'ErrorOutline' as const,
      tone: 'destructive' as const,
      title: intl.formatMessage({ id: ETranslations.log_out_wallet }),
      description: intl.formatMessage({
        id: ETranslations.log_out_wallet_desc,
      }),
      confirmText: intl.formatMessage({ id: ETranslations.global_logout }),
    };
  }

  return {
    icon: 'InfoCircleOutline' as const,
    title: intl.formatMessage({
      id: ETranslations.prime_onekeyid_log_out,
    }),
    description: intl.formatMessage({
      id: ETranslations.prime_onekeyid_log_out_description,
    }),
    confirmText: intl.formatMessage({ id: ETranslations.prime_log_out }),
  };
}

function OneKeyIdLogoutDialogContent({
  source,
  keylessWallet,
  isRemoveToMocked,
  confirmText,
  logoutWithPurchasesSdk,
  reason,
  onBeforeLogout,
  onSuccess,
  onConfirmRemove,
  confirmButtonTestID,
  shouldLogoutOneKeyId,
  preserveLocalKeylessAuthOnOneKeyIdLogout,
}: IOneKeyIdLogoutDialogOptions & {
  confirmText: string;
  logoutWithPurchasesSdk: (params?: {
    preserveLocalKeylessAuth?: boolean;
  }) => Promise<void>;
  shouldLogoutOneKeyId: boolean;
  preserveLocalKeylessAuthOnOneKeyIdLogout: boolean;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [value, setValue] = useState(false);
  const hasKeylessWallet = Boolean(keylessWallet);
  const isFromKeylessWallet =
    source === EOneKeyIdLogoutDialogSource.KeylessWallet;

  const handleChange = useCallback((checked: ICheckedState) => {
    setValue(!!checked);
  }, []);

  return (
    <>
      {hasKeylessWallet ? (
        <Checkbox
          testID="account-manager-is-confirm-disabled-checkbox"
          value={value}
          onChange={handleChange}
          label={intl.formatMessage({
            id: ETranslations.log_out_wallet_checkbox_label,
          })}
        />
      ) : null}
      <Dialog.Footer
        showCancelButton
        onConfirmText={confirmText}
        confirmButtonProps={{
          disabled: hasKeylessWallet && !value,
          testID: confirmButtonTestID,
          ...(hasKeylessWallet ? { variant: 'destructive' as const } : {}),
        }}
        onConfirm={async () => {
          if (keylessWallet) {
            await backgroundApiProxy.servicePassword.promptPasswordVerify({
              reason: EReasonForNeedPassword.Security,
            });
          }

          // The OneKey ID logout must run before the keyless wallet removal:
          // removeWallet triggers cleanupKeylessWalletStorage, which clears
          // the active auth token apiLogout needs to revoke the server-side
          // session. Destructive keyless storage cleanup stays inside
          // removeWallet so it only happens after the DB removal succeeds.
          if (shouldLogoutOneKeyId) {
            await onBeforeLogout?.();
            if (reason) {
              defaultLogger.prime.subscription.onekeyIdLogout({
                reason,
              });
            }
            await logoutWithPurchasesSdk({
              preserveLocalKeylessAuth:
                preserveLocalKeylessAuthOnOneKeyIdLogout,
            });
            await onSuccess?.();
          }

          if (keylessWallet) {
            await actions.current.removeWallet({
              walletId: keylessWallet.id,
              isRemoveToMocked,
            });
          }

          if (isFromKeylessWallet) {
            defaultLogger.account.wallet.deleteWallet();
            onConfirmRemove?.();
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.feedback_change_saved,
              }),
            });
          }
        }}
      />
    </>
  );
}

// Prevent stacking duplicate logout dialogs when the logout entry is tapped
// again while the pre-show bridge calls below are still awaiting (mirrors the
// isPinReminderDialogShowing pattern). Held from entry until the dialog is
// closed on any path (confirm close, cancel, dismiss).
let isOneKeyIdLogoutDialogShowing = false;

export function useShowOneKeyIdLogoutDialog() {
  const intl = useIntl();
  const { logoutWithPurchasesSdk, user } = useOneKeyAuthMethods();
  const isUserOneKeyIdLoggedIn = Boolean(
    user?.isLoggedIn && user?.isLoggedInOnServer,
  );

  return useCallback(
    async (options: IOneKeyIdLogoutDialogOptions) => {
      if (isOneKeyIdLogoutDialogShowing) {
        return;
      }
      isOneKeyIdLogoutDialogShowing = true;
      try {
        let keylessWallet = options.keylessWallet;
        // A transient getKeylessWallet() read failure is UNKNOWN state, not a
        // confirmed "no wallet". Collapsing it into keylessWallet=undefined
        // would flip preserveLocalKeylessAuthOnOneKeyIdLogout to false and run
        // the destructive OneKey ID logout, which clears the shared keyless
        // session slot and deletes every keyless wallet's legacy OAuth refresh
        // blob (the silent-migration / re-login credential) over a momentary
        // read error. Track the failure so the classification below can
        // default to the wallet-preserving branch, mirroring the
        // unknown-source and not-logged-in fallbacks.
        let keylessWalletReadFailed = false;

        if (options.source === EOneKeyIdLogoutDialogSource.OneKeyId) {
          try {
            keylessWallet =
              await backgroundApiProxy.serviceAccount.getKeylessWallet();
          } catch {
            // Fall back to the OneKey ID only logout dialog, preserving the
            // local keyless auth (see keylessWalletReadFailed usage below).
            keylessWalletReadFailed = true;
          }
        }

        const isOneKeyIdLoggedIn =
          options.isOneKeyIdLoggedIn ?? isUserOneKeyIdLoggedIn;
        // Always read the locally persisted auth session source (offline
        // available, device-level): the linked-logout classification below
        // must reflect what backs THIS device's login, never server-side
        // account identities (see classifyOneKeyIdLogoutKeylessHandling in
        // ./oneKeyIdLogoutClassification).
        let authSessionSource: EPrimeAuthSessionSource | undefined;
        if (Boolean(keylessWallet) && isOneKeyIdLoggedIn) {
          try {
            authSessionSource =
              await backgroundApiProxy.simpleDb.prime.getAuthSessionSource();
          } catch {
            // Leave the source undefined; an unknown source defaults to the
            // non-destructive (wallet-preserving) classification.
          }
        }
        // A not-logged-in OneKey ID logout must never remove the keyless
        // wallet: without a confirmed server-side session there is no proof
        // the wallet is OAuth-bound (e.g. the bg invalid-token cleanup may
        // have just flipped the login state), so default to the
        // wallet-preserving classification, same as unknown identity data.
        const {
          shouldSkipLinkedLogout,
          preserveLocalKeylessAuthOnOneKeyIdLogout,
        } = classifyOneKeyIdLogoutKeylessHandling({
          isOneKeyIdSource:
            options.source === EOneKeyIdLogoutDialogSource.OneKeyId,
          hasKeylessWallet: Boolean(keylessWallet),
          keylessWalletReadFailed,
          isOneKeyIdLoggedIn,
          authSessionSource,
        });
        const shouldLogoutKeylessWallet =
          Boolean(keylessWallet) &&
          !(
            options.source === EOneKeyIdLogoutDialogSource.OneKeyId &&
            shouldSkipLinkedLogout
          );
        const shouldLogoutOneKeyId =
          options.source === EOneKeyIdLogoutDialogSource.OneKeyId ||
          (options.source === EOneKeyIdLogoutDialogSource.KeylessWallet &&
            isOneKeyIdLoggedIn &&
            !shouldSkipLinkedLogout);
        const keylessWalletForDialog = shouldLogoutKeylessWallet
          ? keylessWallet
          : undefined;
        const shouldLinkKeylessOneKeyIdLogout =
          Boolean(keylessWalletForDialog) && shouldLogoutOneKeyId;

        const content = getOneKeyIdLogoutDialogContent({
          intl,
          source: options.source,
          keylessWallet: keylessWalletForDialog,
          shouldLinkKeylessOneKeyIdLogout,
        });

        Dialog.show({
          icon: content.icon,
          tone: content.tone,
          title: content.title,
          description: content.description,
          onClose: () => {
            isOneKeyIdLogoutDialogShowing = false;
          },
          renderContent: (
            <AccountSelectorProviderMirror
              enabledNum={[0]}
              config={
                options.config ?? { sceneName: EAccountSelectorSceneName.home }
              }
            >
              <OneKeyIdLogoutDialogContent
                {...options}
                keylessWallet={keylessWalletForDialog}
                confirmText={content.confirmText}
                logoutWithPurchasesSdk={logoutWithPurchasesSdk}
                shouldLogoutOneKeyId={shouldLogoutOneKeyId}
                preserveLocalKeylessAuthOnOneKeyIdLogout={
                  preserveLocalKeylessAuthOnOneKeyIdLogout
                }
              />
            </AccountSelectorProviderMirror>
          ),
        });
      } catch (error) {
        // Release the guard if anything before Dialog.show throws; once the
        // dialog is shown, onClose above releases it instead.
        isOneKeyIdLogoutDialogShowing = false;
        throw error;
      }
    },
    [intl, isUserOneKeyIdLoggedIn, logoutWithPurchasesSdk],
  );
}
