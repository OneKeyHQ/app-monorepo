import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { CoreApi } from '@onekeyfe/hd-core';

export class ServiceHardwareManagerBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  async getSDKInstance({ connectId }: { connectId: string }): Promise<CoreApi> {
    const hardwareSDK = await this.serviceHardware.getSDKInstance({
      connectId,
    });
    return hardwareSDK;
  }

  get serviceHardware() {
    const { serviceHardware } = this.backgroundApi;
    return serviceHardware;
  }
}
