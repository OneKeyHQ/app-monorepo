import { createInstance } from 'dotbit';
import { filter, groupBy, map } from 'lodash';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import {
  COINTYPE_BTC,
  COINTYPE_DOGE,
  COINTYPE_ETH,
  COINTYPE_LTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

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
  label?: string;
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
          [OnekeyNetwork.btc]: ['btc'],
          [OnekeyNetwork.ltc]: ['ltc'],
          [OnekeyNetwork.doge]: ['doge'],
        },
        resolver: this.resolveENS.bind(this),
      },
      {
        pattern: /\.bit$/,
        shownSymbol: '.bit',
        supportImplsMap: {
          'evm--*': ['eth', 'bsc', 'etc', 'polygon', 'celo'],
          [OnekeyNetwork.btc]: ['btc'],
          [OnekeyNetwork.near]: ['near'],
          [OnekeyNetwork.sol]: ['sol'],
          [OnekeyNetwork.trx]: ['trx'],
          [OnekeyNetwork.ltc]: ['ltc'],
          [OnekeyNetwork.doge]: ['doge'],
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

  async _resolveName(name: string, options?: ResolverOptions) {
    const isValid = await this.checkIsValidName(name);

    const config = this.config.find((c) => c.pattern.test(name));

    if (!isValid || !config)
      return {
        success: false,
        message: 'form__address_no_supported_address',
        shownSymbol: '-',
      };

    const names: ResolverNameList | null | string | undefined =
      await config?.resolver(name);

    if (!names) {
      return {
        success: false,
        message: 'message__fetching_error',
        shownSymbol: config?.shownSymbol,
      };
    }

    if (typeof names === 'string') {
      return {
        success: false,
        message: names,
        shownSymbol: config?.shownSymbol,
      };
    }

    if (!names.length) {
      return {
        success: false,
        message: 'form__address_no_supported_address',
        shownSymbol: config?.shownSymbol,
      };
    }

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
            .includes(items.subtype?.toUpperCase?.() ?? ''),
        )
      : validNamesPipe;

    const groupedNames = map(
      groupBy(validNames, 'subtype'),
      (items, symbol) => ({
        title: symbol?.toUpperCase?.(),
        options: map(items, (item) => ({
          value: `${item.key}-${item.value}`,
          label: shortenAddress(item.value),
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
  }

  @backgroundMethod()
  async resolveName(name: string, options?: ResolverOptions) {
    const result = await this._resolveName(name, options);
    return result;
  }

  async resolveENS(name: string): Promise<ResolverNameList | null | string> {
    const { engine } = this.backgroundApi;

    // always using ETH mainnet for name resolve
    const chainOnlyVault = await engine.getChainOnlyVault(OnekeyNetwork.eth);
    try {
      const ethersProvider = await chainOnlyVault.getEthersProvider();
      const resolver = await ethersProvider.getResolver(name);
      if (!resolver) {
        return null;
      }

      const btcAddress = await resolver.getAddress(Number(COINTYPE_BTC));
      const ethAddress = await resolver.getAddress(Number(COINTYPE_ETH));
      const dogeAddress = await resolver.getAddress(Number(COINTYPE_DOGE));
      const ltcAddress = await resolver.getAddress(Number(COINTYPE_LTC));

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
        {
          subtype: 'ltc',
          value: ltcAddress,
          type: 'address',
          key: 'address.ltc',
        },
        {
          subtype: 'doge',
          value: dogeAddress,
          type: 'address',
          key: 'address.doge',
        },
      ].filter((item) => !!item.value);

      return validNames;
    } catch (e) {
      return 'msg__network_request_failed';
    }
  }

  async resolveDotBit(name: string): Promise<ResolverNameList | null | string> {
    const instance = createInstance();
    try {
      const names = await instance.records(name);
      return names;
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 20007) {
        return null;
      }

      return 'msg__network_request_failed';
    }
  }
}
