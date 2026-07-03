import { Dialog, SizableText, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
