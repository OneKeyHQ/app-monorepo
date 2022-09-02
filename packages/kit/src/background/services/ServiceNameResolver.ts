import { createInstance } from 'dotbit';
import { filter, groupBy, map } from 'lodash';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  COINTYPE_BTC,
  COINTYPE_ETH,
  NETWORK_ID_EVM_ETH,
} from '@onekeyhq/engine/src/constants';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

type ResolverOptions = {
  /** @deprecated: TODO: disable btc shown at dotbit response. */
  disableBTC?: boolean;
  /** filter white list network id */
  networkId?: string;
};

type ResolverNames = {
  subtype: string;
  value: string;
  type: string;
  key: string;
};

type ResolverNameList = ResolverNames[];

@backgroundClass()
export default class ServiceNameResolver extends ServiceBase {
  get config() {
    const NAME_RESOLVER = [
      {
        pattern: /\.eth$/,
        shownSymbol: 'ENS',
        supportImplsMap: {
          'evm--*': ['eth'],
          'btc--0': ['btc'],
        },
        resolver: this.resolveENS.bind(this),
      },
      {
        pattern: /\.bit$/,
        shownSymbol: '.bit',
        supportImplsMap: {
          'evm--*': ['eth', 'bsc', 'etc', 'polygon', 'celo'],
          'btc--0': ['btc'],
          'near--0': ['near'],
          'sol--101': ['sol'],
        },
        resolver: this.resolveDotBit.bind(this),
      },
    ];
    return NAME_RESOLVER;
  }

  @backgroundMethod()
  async checkIsValidName(name: string) {
    const status = this.config.some((resolver) => resolver.pattern.test(name));
    return Promise.resolve(status);
  }

  @backgroundMethod()
  async resolveName(name: string, options?: ResolverOptions) {
    const isValid = await this.checkIsValidName(name);

    const config = this.config.find((c) => c.pattern.test(name));

    if (!isValid || !config)
      return {
        success: false,
        message: 'message__fetching_error',
        shownSymbol: '-',
      };

    const names: ResolverNameList = (await config?.resolver(name)) ?? [];

    if (!names.length)
      return {
        success: false,
        message: 'message__fetching_error',
        shownSymbol: config?.shownSymbol,
      };

    /** only filter address type from dotbit */
    const addressNames = names.filter((item) => item.type === 'address');

    /** TODO: use black list to filter & need support btc address at watched account */
    const validNamesPipe = options?.disableBTC
      ? filter(
          addressNames,
          (items) => items?.subtype?.toUpperCase?.() !== 'BTC',
        )
      : addressNames;
    const filterNetworkList = (network?: string): string[] => {
      if (!network) return [];
      if (network.startsWith('evm')) {
        return config.supportImplsMap['evm--*'];
      }
      return config.supportImplsMap[network as 'evm--*'] ?? [];
    };
    const validNames = options?.networkId
      ? filter(validNamesPipe, (items) =>
          filterNetworkList(options.networkId)
            .map((item) => item.toUpperCase())
            .includes(items.subtype?.toUpperCase?.()),
        )
      : validNamesPipe;

    const groupedNames = map(
      groupBy(validNames, 'subtype'),
      (items, symbol) => ({
        title: symbol?.toUpperCase?.(),
        options: map(items, (item) => ({
          value: `${item.key}-${item.value}`,
          label: shortenAddress(item.value),
        })),
      }),
    );

    return {
      success: true,
      names: groupedNames,
      length: validNames.length,
      shownSymbol: config?.shownSymbol,
    };
  }

  async resolveENS(name: string): Promise<ResolverNameList> {
    const { engine } = this.backgroundApi;

    // always using ETH mainnet for name resolve
    const chainOnlyVault = await engine.getChainOnlyVault(NETWORK_ID_EVM_ETH);
    try {
      const ethersProvider = await chainOnlyVault.getEthersProvider();

      const resolver = await ethersProvider.getResolver(name);

      if (!resolver) {
        return [];
      }
      const btcAddress = await resolver.getAddress(Number(COINTYPE_BTC));
      const ethAddress = await resolver.getAddress(Number(COINTYPE_ETH));

      const validNames = [
        {
          subtype: 'btc',
          value: btcAddress,
          type: 'address',
          key: 'address.btc',
        },
        {
          subtype: 'eth',
          value: ethAddress,
          type: 'address',
          key: 'address.eth',
        },
      ].filter((item) => !!item.value);
      return validNames;
    } catch (e) {
      return [];
    }
  }

  async resolveDotBit(name: string): Promise<ResolverNameList> {
    const instance = createInstance();
    try {
      const names = await instance.records(name);
      return names;
    } catch (e) {
      return [];
    }
  }
}
