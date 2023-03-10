import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceAddressbook extends ServiceBase {
  // eslint-disable-next-line @typescript-eslint/require-await
  @backgroundMethod()
  async getItem(params: { address: string }) {
    const { appSelector } = this.backgroundApi;
    const contacts = appSelector((s) => s.contacts.contacts);
    const values = Object.values(contacts);
    return values.find(
      (item) => item.address.toLowerCase() === params.address.toLowerCase(),
    );
  }
}

export default ServiceAddressbook;
