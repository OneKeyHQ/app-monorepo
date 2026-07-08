import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';

export const shouldOpenEarnHomeInExtensionExpandTab =
  platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;

export function openExtensionEarnHomeInExpandTab() {
  return backgroundApiProxy.serviceApp
    .openExtensionExpandTab({ path: '/defi' })
    .then(closeExtensionPopupAfterExpandTabOpen);
}
