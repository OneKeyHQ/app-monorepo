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
    try {
      const client = await this.getClient();
      const resp = await client.get<{
        data: IResolveNameResp;
      }>('/wallet/v1/account/resolve-name', {
        params: {
          name,
          networkId,
        },
      });
      const resolvedNames = resp.data.data.name;

      if (!resolvedNames) {
        return {
          success: false,
          message: 'message__fetching_error',
        };
      }

      if (!resolvedNames.length) {
        return {
          success: false,
          message: 'form__address_no_supported_address',
        };
      }

      /** only filter address type from dot bit */
      const addressNames = resolvedNames.filter(
        (item) => item.type === 'address',
      );

      const groupedNames = map(
        groupBy(addressNames, 'subtype'),
        (items, symbol) => ({
          title: symbol?.toUpperCase?.(),
          options: map(items, (item) => ({
            value: `${item.key}-${item.value}`,
            label: accountUtils.shortenAddress({
              address: item.value,
            }),
            badge: item.label,
          })),
        }),
      );

      if (!addressNames.length) {
        return {
          success: false,
          message: 'form__address_no_supported_address',
        };
      }

      return {
        success: true,
        names: groupedNames,
        length: addressNames.length,
      };
    } catch (e) {
      return {
        success: false,
        message: 'message__fetching_error',
      };
    }
  }
}

export default ServiceNameResolver;
