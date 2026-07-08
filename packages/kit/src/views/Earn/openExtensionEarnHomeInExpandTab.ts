import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';

export const shouldOpenEarnHomeInExtensionExpandTab =
  platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;

export async function openExtensionEarnHomeInExpandTab() {
  const { default: backgroundApiProxy } =
    await import('../../background/instance/backgroundApiProxy');
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({ path: '/defi' });
  closeExtensionPopupAfterExpandTabOpen();
}
