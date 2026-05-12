import BackgroundApi from '@onekeyhq/kit-bg/src/apis/BackgroundApi';

function backgroundApiInit() {
  globalThis.$onekeyIsInBackground = true;
  const backgroundApi = new BackgroundApi();
  return backgroundApi;
}
export default backgroundApiInit;
