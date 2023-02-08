import { omit } from 'lodash';

import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceDerivationPath extends ServiceBase {
  @backgroundMethod()
  async getDerivationSelectOptions(networkId: string | undefined) {
    if (!networkId) return [];
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    let accountNameInfo = getAccountNameInfoByImpl(network.impl);
    if (network.impl === IMPL_EVM && network.symbol !== 'ETC') {
      accountNameInfo = omit(accountNameInfo, 'etcNative');
    }
    return Object.entries(accountNameInfo).map(([k, v]) => ({ ...v, key: k }));
  }
}
