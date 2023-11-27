import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountHistory } from '@onekeyhq/shared/types/history';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHistory extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoFetchAccountHistory() {
    const nfts = require('../mocks/home/history.json') as IAccountHistory[];
    return Promise.resolve(nfts);
  }
}

export default ServiceHistory;
