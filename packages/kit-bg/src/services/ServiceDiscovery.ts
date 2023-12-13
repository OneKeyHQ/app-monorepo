import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDiscovery extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchHistoryData(page = 1, pageSize = 15) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const result =
      await this.backgroundApi.simpleDb.browserHistory.getRawData();
    const history = result?.data;
    if (!Array.isArray(history)) {
      return [];
    }
    if (start >= history.length) {
      return [];
    }
    return history.slice(start, Math.min(history.length, end));
  }

  @backgroundMethod()
  clearBrowserHistory() {
    return this.backgroundApi.simpleDb.browserHistory.clearRawData();
  }
}

export default ServiceDiscovery;
