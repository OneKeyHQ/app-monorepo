import { filter, groupBy, map } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  INameResolver,
  IResolveNameParams,
  IResolveNameResp,
} from '@onekeyhq/shared/types/name';

import { getBaseEndpoint } from '../endpoints';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNameResolver extends ServiceBase {
  get config() {
    const NAME_RESOLVER = [
      {
        pattern: /\.eth$/,
        shownSymbol: 'ENS',
        supportImplMap: {
          'evm--*': ['eth'],
          [OnekeyNetwork.btc]: ['btc'],
          [OnekeyNetwork.ltc]: ['ltc'],
          [OnekeyNetwork.doge]: ['doge'],
        },
      },
      {
        pattern: /\.bit$/,
        shownSymbol: '.bit',
        supportImplMap: {
          'evm--*': ['eth', 'bsc', 'etc', 'polygon', 'celo'],
          [OnekeyNetwork.btc]: ['btc'],
          [OnekeyNetwork.near]: ['near'],
          [OnekeyNetwork.sol]: ['sol'],
          [OnekeyNetwork.trx]: ['trx'],
          [OnekeyNetwork.ltc]: ['ltc'],
          [OnekeyNetwork.doge]: ['doge'],
        },
      },
      {
        pattern:
          /(\.crypto|\.bitcoin|\.blockchain|\.dao|\.nft|\.888|\.wallet|\.x|\.klever|\.zil|\.hi)$/,
        shownSymbol: 'UD',
        supportImplMap: {
          'evm--*': [
            'ETH',
            'POLY',
            'CRO',
            'CELO',
            'AVAX',
            'OKT',
            'ETC',
            'BNB.VERSION.BEP20',
            'FTM.VERSION.ERC20',
            'FTM.VERSION.OPERA',
          ],
          [OnekeyNetwork.ada]: ['ADA'],
          [OnekeyNetwork.algo]: ['ALGO'],
          [OnekeyNetwork.apt]: ['APT'],
          [OnekeyNetwork.sui]: ['SUI'],
          [OnekeyNetwork.bch]: ['BCH'],
          [OnekeyNetwork.btc]: ['BTC'],
          [OnekeyNetwork.cfx]: ['CFX'],
          [OnekeyNetwork.doge]: ['DOGE'],
          [OnekeyNetwork.fil]: ['FIL'],
          [OnekeyNetwork.ltc]: ['LTC'],
          [OnekeyNetwork.near]: ['NEAR'],
          [OnekeyNetwork.sol]: ['SOL'],
          [OnekeyNetwork.trx]: ['TRX'],
          [OnekeyNetwork.xrp]: ['XRP'],
          [OnekeyNetwork.cosmoshub]: ['ATOM'],
          [OnekeyNetwork.fetch]: ['FET.version.FETCHAI'],
        },
      },
      {
        pattern: /(\.bnb|\.arb)$/,
        shownSymbol: 'SID',
        supportImplMap: {
          'evm--*': ['eth', 'bsc', 'arbitrum'],
        },
      },
      {
        pattern: /^0x[a-fA-F0-9]{40}$/,
        shownSymbol: 'FIL',
        supportImplMap: {
          [OnekeyNetwork.fil]: ['fil'],
        },
        resolver: this.resolveFilEvm.bind(this),
        networkRequired: true,
      },
      {
        pattern: /(\.zk|\.base|\.linea)$/,
        shownSymbol: 'STAR',
        supportImplMap: {
          'evm--*': ['eth'],
          [OnekeyNetwork.apt]: ['APT'],
          [OnekeyNetwork.ltc]: ['LTC'],
          [OnekeyNetwork.sui]: ['SUI'],
          [OnekeyNetwork.btc]: ['BTC'],
          [OnekeyNetwork.doge]: ['DOGE'],
        },
      },
    ];
    return NAME_RESOLVER;
  }

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async checkIsValidName({
    name,
    networkId,
  }: {
    name: string;
    networkId: string;
  }) {
    const status = this.config.some((resolver) => {
      if (networkId) {
        const support = networkId.startsWith('evm--')
          ? resolver.supportImplMap['evm--*']
          : resolver.supportImplMap[networkId as 'evm--*'];
        return !!support && resolver.pattern.test(name);
      }
      return !resolver.networkRequired && resolver.pattern.test(name);
    });
    return Promise.resolve(status);
  }

  @backgroundMethod()
  async resolveName({ name, networkId }: IResolveNameParams) {
    const isValid = await this.checkIsValidName({
      name,
      networkId,
    });

    const config = this.config.find((c) => c.pattern.test(name));

    if (!isValid || !config)
      return {
        success: false,
        message: 'form__address_no_supported_address',
        shownSymbol: '-',
      };

    try {
      let resolvedNames;

      if (config.resolver) {
        resolvedNames = await config.resolver(name);
      } else {
        const client = await this.getClient();
        const endpoint = await getBaseEndpoint();
        const resp = await client.get<{
          data: IResolveNameResp;
        }>(`${endpoint}/v5/account/resolve-name`, {
          params: {
            name,
            networkId,
          },
        });
        resolvedNames = resp.data.data.name;
      }

      if (!resolvedNames) {
        return {
          success: false,
          message: 'message__fetching_error',
          shownSymbol: config?.shownSymbol,
        };
      }

      if (!resolvedNames.length) {
        return {
          success: false,
          message: 'form__address_no_supported_address',
          shownSymbol: config?.shownSymbol,
        };
      }

      /** only filter address type from dot bit */
      const addressNames = resolvedNames.filter(
        (item) => item.type === 'address',
      );

      const filterNetworkList = (network?: string): string[] => {
        if (!network) return [];
        if (network.startsWith('evm')) {
          return config.supportImplMap['evm--*'] ?? [];
        }
        return config.supportImplMap[network as 'evm--*'] ?? [];
      };
      const validNames = filter(addressNames, (items) =>
        filterNetworkList(networkId)
          .map((item) => item.toUpperCase())
          .includes(items.subtype?.toUpperCase?.() ?? ''),
      );

      const groupedNames = map(
        groupBy(validNames, 'subtype'),
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

      if (!validNames.length) {
        return {
          success: false,
          message: 'form__address_no_supported_address',
          shownSymbol: config?.shownSymbol,
        };
      }

      return {
        success: true,
        names: groupedNames,
        length: validNames.length,
        shownSymbol: config?.shownSymbol,
      };
    } catch (e) {
      return {
        success: false,
        message: 'message__fetching_error',
        shownSymbol: config?.shownSymbol,
      };
    }
  }

  async resolveFilEvm(name: string): Promise<INameResolver[]> {
    const filEvmAddress = '';
    return [
      {
        subtype: 'fil',
        value: filEvmAddress,
        type: 'address',
        key: 'fileEvmAddress',
      },
    ];
  }
}

export default ServiceNameResolver;
