// eslint-disable-next-line @typescript-eslint/no-unused-vars
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// firefox navigation.navigate() does not working isExtensionUiStandaloneWindow
// export const IS_REPLACE_ROUTE_TO_FEE_EDIT =
//   platformEnv.isExtFirefox && platformEnv.isExtensionUiStandaloneWindow;
export const IS_REPLACE_ROUTE_TO_FEE_EDIT = false;

// export const IS_LAZY_NAVIGATE_SUB_ROUTER = false;
export const IS_LAZY_NAVIGATE_SUB_ROUTER = !!platformEnv.isExtFirefox;
