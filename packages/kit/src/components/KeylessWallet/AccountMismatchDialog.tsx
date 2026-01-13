import { Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

/**
 * Show a dialog for Android when Google Drive account doesn't match the OAuth account.
 * Provides option to log out of Google Drive so user can re-authenticate with correct account.
 */
export async function showGoogleDriveMismatchDialog(params: {
  intl: IntlShape;
  oauthEmail?: string;
  cloudEmail?: string;
}): Promise<{ loggedOut: boolean }> {
  const { intl, oauthEmail, cloudEmail } = params;

  // TODO: Replace with proper translation key when available
  // Translation key: keyless_wallet_google_drive_mismatch_desc
  const description = `Your Google Drive is signed in with ${
    cloudEmail || 'a different account'
  }, but you authenticated with ${
    oauthEmail || 'another account'
  }. Log out of Google Drive to sign in with the correct account.`;

  return new Promise((resolve) => {
    Dialog.show({
      icon: 'ErrorOutline',
      title: intl.formatMessage({
        id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
      }),
      renderContent: (
        <YStack>
          <Dialog.Description>
            <SizableText>{description}</SizableText>
          </Dialog.Description>
          <Dialog.Footer
            showCancelButton
            // TODO: Replace with translation key: keyless_wallet_logout_google_drive
            onConfirmText="Log out of Google Drive"
            onConfirm={async () => {
              await backgroundApiProxy.serviceCloudBackup.logoutFromGoogleDrive(
                true,
              );
              resolve({ loggedOut: true });
            }}
            onCancel={() => resolve({ loggedOut: false })}
          />
        </YStack>
      ),
      showFooter: false,
      onClose: () => resolve({ loggedOut: false }),
    });
  });
}

/**
 * Show a dialog for iOS when Apple ID doesn't match the keyless wallet.
 * Provides instructions on how to switch Apple ID in device Settings.
 */
export function showAppleIDMismatchDialog(params: { intl: IntlShape }): void {
  const { intl } = params;

  // TODO: Replace with proper translation key when available
  // Translation key: keyless_wallet_apple_id_mismatch_desc
  const description = `The Apple ID on this device doesn't match the one used to create this keyless wallet. To resolve this:

1. Go to Settings > [Your Name] > Sign Out
2. Sign in with the correct Apple ID
3. Return to the app and try again`;

  Dialog.show({
    icon: 'ErrorOutline',
    title: intl.formatMessage({
      id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
    }),
    renderContent: (
      <YStack>
        <Dialog.Description>
          <SizableText>{description}</SizableText>
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
