import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export default class OffscreenApiXmrSdk {
  async showMe() {
    await timerUtils.wait(3000);
    return 'Hello World: OffscreenApiXmrSdk';
  }
}
