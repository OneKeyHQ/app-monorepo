import BackgroundApi from '@onekeyhq/kit-bg/src/apis/BackgroundApi';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function backgroundApiInit() {
  globalThis.$onekeyIsInBackground =
    platformEnv.isExtensionBackground || platformEnv.isNativeBackgroundThread;
  const backgroundApi = new BackgroundApi();
  return backgroundApi;
}
export default backgroundApiInit;
