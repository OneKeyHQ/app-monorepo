import { groupBy, map } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IResolveNameParams,
  IResolveNameResp,
} from '@onekeyhq/shared/types/name';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNameResolver extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async resolveName({ name, networkId }: IResolveNameParams) {
    const client = await this.getClient();
    const resp = await client.get<{
      data: IResolveNameResp;
    }>('/wallet/v1/account/resolve-name', {
      params: {
        name,
        networkId,
      },
    });
    const resolved = resp.data.data;
    const { showSymbol, names: resolvedNames } = resolved;

    const groupedNames = map(
      groupBy(resolvedNames, 'subtype'),
      (items, symbol) => ({
        title: symbol?.toUpperCase?.(),
        data: map(items, (item) => ({
          value: item.value,
          label: accountUtils.shortenAddress({
            address: item.value,
          }),
        })),
      }),
    );

    return {
      names: groupedNames,
      length: resolvedNames.length,
      showSymbol,
    };
  }
}

export default ServiceNameResolver;
