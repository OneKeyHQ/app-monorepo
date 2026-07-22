import { Dialog, SizableText, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getOAuthSocialLoginProviderName } from '@onekeyhq/shared/src/utils/oauthProviderUtils';

import { getDisplayEmailOrUnknown } from '../OneKeyAuth/oneKeyIdDisplayEmailUtils';

import type { IntlShape } from 'react-intl';

/**
 * Show a dialog for Android when Google Drive account doesn't match the OAuth account.
 * Provides option to log out of Google Drive so user can re-authenticate with correct account.
 */
export function showGoogleDriveMismatchDialog(params: {
  intl: IntlShape;
}): void {
  const { intl } = params;

  void Dialog.show({
    icon: 'ErrorOutline',
    title: intl.formatMessage({
      id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
    }),
    renderContent: (
      <YStack>
        <Dialog.Description>
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.keyless_wallet_google_drive_mismatch_desc,
            })}
          </SizableText>
        </Dialog.Description>
        <Dialog.Footer
          showCancelButton
          onConfirmText={intl.formatMessage({
            id: ETranslations.keyless_wallet_logout_google_drive,
          })}
          onConfirm={async () => {
            await backgroundApiProxy.serviceCloudBackup.logoutFromGoogleDrive(
              true,
            );
          }}
        />
      </YStack>
    ),
    showFooter: false,
  });
}

/**
 * Show a dialog for iOS when Apple ID doesn't match the keyless wallet.
 * Provides instructions on how to switch Apple ID in device Settings.
 */
export function showAppleIDMismatchDialog(params: { intl: IntlShape }): void {
  const { intl } = params;

  void Dialog.show({
    icon: 'ErrorOutline',
    title: intl.formatMessage({
      id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
    }),
    renderContent: (
      <YStack>
        <Dialog.Description>
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.keyless_wallet_apple_id_mismatch_desc,
            })}
          </SizableText>
        </Dialog.Description>
        <Dialog.Footer
          showCancelButton={false}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_ok,
          })}
        />
      </YStack>
    ),
    showFooter: false,
  });
}

// Prevent stacking multiple conflict dialogs if concurrent flows race to
// persist a keyless session (mirrors the isPinReminderDialogShowing pattern).
let isOneKeyIdSessionConflictDialogShowing = false;

/**
 * Shown when a validated keyless OAuth session about to be persisted belongs
 * to a DIFFERENT account than the one backing the live OneKey ID login
 * (single shared keyless session slot — persisting would silently destroy
 * that login). Resolves true when the user confirms; the CALLER must then
 * log OneKey ID out (recoverable by re-login) and continue — the keyless
 * wallet itself is NEVER logged out or removed. Resolves false on cancel or
 * dismiss; the caller must abort without persisting anything.
 */
export async function showKeylessOneKeyIdSessionConflictDialog(params: {
  intl: IntlShape;
  currentOneKeyIdEmail: string;
}): Promise<boolean> {
  const { intl, currentOneKeyIdEmail } = params;
  if (isOneKeyIdSessionConflictDialogShowing) {
    return false;
  }
  isOneKeyIdSessionConflictDialogShowing = true;
  const displayEmail = getDisplayEmailOrUnknown({
    intl,
    displayEmail: currentOneKeyIdEmail,
  });
  return new Promise<boolean>((resolve) => {
    let isSettled = false;
    const settle = (value: boolean) => {
      if (!isSettled) {
        isSettled = true;
        isOneKeyIdSessionConflictDialogShowing = false;
        resolve(value);
      }
    };
    Dialog.show({
      icon: 'ErrorOutline',
      title: intl.formatMessage({
        id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
      }),
      // TODO: i18n
      description: `You are signed in to OneKey ID as ${displayEmail}, but this Keyless wallet is linked to a different account. Continuing will log you out of OneKey ID (you can log in again later); the Keyless wallet stays untouched.`,
      showCancelButton: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

export async function showOneKeyIdOAuthReauthAccountMismatchDialog(params: {
  intl: IntlShape;
  provider: EOAuthSocialLoginProvider;
}): Promise<boolean> {
  const { intl, provider } = params;
  const providerName = getOAuthSocialLoginProviderName(provider);
  return new Promise<boolean>((resolve) => {
    let isSettled = false;
    const settle = (value: boolean) => {
      if (!isSettled) {
        isSettled = true;
        resolve(value);
      }
    };
    Dialog.show({
      icon: 'ErrorOutline',
      title: intl.formatMessage({
        id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
      }),
      // TODO: i18n
      description: `This ${providerName} account isn't the one linked to your current OneKey ID. Please choose the linked account and try again.`,
      showCancelButton: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_retry,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

export function showKeylessWalletAccountMismatchError(params: {
  intl: IntlShape;
  keylessProvider?: EOAuthSocialLoginProvider;
  forceToast?: boolean;
}): void {
  const { intl, keylessProvider, forceToast } = params;
  const isAndroidWithGoogle =
    platformEnv.isNativeAndroid &&
    keylessProvider === EOAuthSocialLoginProvider.Google;
  const isIOSWithApple =
    platformEnv.isNativeIOS &&
    keylessProvider === EOAuthSocialLoginProvider.Apple;

  if (!forceToast && isAndroidWithGoogle) {
    showGoogleDriveMismatchDialog({ intl });
    return;
  }
  if (!forceToast && isIOSWithApple) {
    showAppleIDMismatchDialog({ intl });
    return;
  }

  Toast.error({
    title: intl.formatMessage({
      id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
    }),
    message: intl.formatMessage({
      id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
    }),
  });
}
