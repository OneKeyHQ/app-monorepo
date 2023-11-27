import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ICollection } from '@onekeyhq/shared/types/nft';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNFT extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async demoFetchAccountNFTs() {
    const nfts = require('../mocks/home/nfts.json') as ICollection[];
    return Promise.resolve(nfts);
  }
}

export default ServiceNFT;
