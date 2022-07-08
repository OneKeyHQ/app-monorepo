import platformEnv from '@onekeyhq/shared/src/platformEnv';

// firefox navigation.navigate() does not working isExtensionUiStandaloneWindow
export const IS_REPLACE_ROUTE_TO_FEE_EDIT =
  platformEnv.isExtFirefox && platformEnv.isExtensionUiStandaloneWindow;
