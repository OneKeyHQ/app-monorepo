import SID, { getSidAddress } from '@siddomains/sidjs';
import { Resolution } from '@unstoppabledomains/resolution';
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
      {
        pattern:
          /(\.crypto|\.bitcoin|\.blockchain|\.dao|\.nft|\.888|\.wallet|\.x|\.klever|\.zil|\.hi)$/,
        shownSymbol: 'UD',
        supportImplsMap: {
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
        resolver: this.resolveUnstoppableDomains.bind(this),
      },
      {
        pattern: /(\.bnb|\.arb)$/,
        shownSymbol: 'SID',
        supportImplsMap: {
          'evm--*': ['eth', 'bsc', 'arbitrum'],
        },
        resolver: this.resolveSIDDomains.bind(this),
      },
      {
        pattern: /^0x[a-fA-F0-9]{40}$/,
        shownSymbol: 'FIL',
        supportImplsMap: {
          [OnekeyNetwork.fil]: ['fil'],
        },
        resolver: this.resolveFilEvm.bind(this),
        networkRequired: true,
      },
    ];
    return NAME_RESOLVER;
  }

  // UD libs api allNonEmptyRecords unusable，so use records api

  private UDSupportKeys = [
    'crypto.ETH.address',
    'crypto.POLY.address',
    'crypto.CRO.address',
    'crypto.CELO.address',
    'crypto.AVAX.address',
    'crypto.OKT.address',
    'crypto.ETC.address',
    'crypto.BNB.VERSION.BEP20.address',
    'crypto.FTM.VERSION.ERC20.address',
    'crypto.FTM.VERSION.OPERA.address',
    'crypto.ADA.address',
    'crypto.ALGO.address',
    'crypto.APT.address',
    'crypto.SUI.address',
    'crypto.BCH.address',
    'crypto.BTC.address',
    'crypto.CFX.address',
    'crypto.DOGE.address',
    'crypto.FIL.address',
    'crypto.LTC.address',
    'crypto.NEAR.address',
    'crypto.SOL.address',
    'crypto.TRX.address',
    'crypto.XRP.address',
    'crypto.ATOM.address',
    'crypto.FET.version.FETCHAI.address',
  ];

  @backgroundMethod()
  async checkIsValidName(name: string, networId?: string) {
    const status = this.config.some((resolver) => {
      if (networId) {
        const support = networId.startsWith('evm--')
          ? resolver.supportImplsMap['evm--*']
          : resolver.supportImplsMap[networId as 'evm--*'];
        return !!support && resolver.pattern.test(name);
      }
      return !resolver.networkRequired && resolver.pattern.test(name);
    });
    return Promise.resolve(status);
  }

  async _resolveName(name: string, options?: ResolverOptions) {
    const isValid = await this.checkIsValidName(name, options?.networkId);

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
        return config.supportImplsMap['evm--*'] ?? [];
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

  async resolveUnstoppableDomains(
    name: string,
  ): Promise<ResolverNameList | null | string> {
    const resolution = new Resolution();
    let names: ResolverNames[] = [];
    try {
      const records = await resolution.records(name, this.UDSupportKeys);
      Object.keys(records).forEach((key) => {
        const value = records[key];
        if (value?.length) {
          const subtype = key.replace('crypto.', '').replace('.address', '');
          const result = {
            subtype,
            value,
            type: 'address',
            key,
          };
          names = [...names, result];
        }
      });
    } catch (e) {
      return 'msg__network_request_failed';
    }
    return names;
  }

  async resolveSIDDomains(name: string) {
    const { engine } = this.backgroundApi;
    let names: ResolverNames[] = [];
    let netWorks = ['eth'];
    if (name.endsWith('.bnb')) {
      netWorks = [...netWorks, 'bsc'];
    }
    if (name.endsWith('.arb')) {
      netWorks = [...netWorks, 'arbitrum'];
    }
    try {
      for (const net of netWorks) {
        const chainOnlyVault = await engine.getChainOnlyVault(
          Object.getOwnPropertyDescriptor(OnekeyNetwork, net)?.value,
        );
        const provider = await chainOnlyVault.getEthersProvider();
        const chainId = await chainOnlyVault.getNetworkChainId();
        const sidAddress = getSidAddress(chainId);
        const sid = new SID({
          provider,
          sidAddress,
        });
        const sidName = sid.name(name);
        const address = await sidName.getAddress();
        if (
          address &&
          address !== '0x0000000000000000000000000000000000000000'
        ) {
          const result = {
            subtype: net,
            value: address,
            type: 'address',
            key: `address.${net}`,
          };
          names = [...names, result];
        }
      }
    } catch (e) {
      return 'msg__network_request_failed';
    }
    return names;
  }

  async resolveFilEvm(name: string) {
    const { engine } = this.backgroundApi;

    const chainOnlyVault = await engine.getChainOnlyVault(OnekeyNetwork.fil);
    const filEvmAddress = await chainOnlyVault.validateAddress(name);
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
