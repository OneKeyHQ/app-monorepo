/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { Buffer } from 'buffer';

import elliptic from 'elliptic';

import { ProviderController as BaseProviderController } from '@onekeyhq/blockchain-libs/dist/provider';
import {
  BaseClient,
  BaseProvider,
  ClientFilter,
} from '@onekeyhq/blockchain-libs/dist/provider/abc';
import { ChainInfo } from '@onekeyhq/blockchain-libs/dist/types/chain';

import { IMPL_EVM } from './constants';
import { OneKeyInternalError } from './errors';
import { DBNetwork } from './types/network';

// IMPL naming aren't necessarily the same.
const IMPL_MAPPINGS: Record<string, string> = {};
IMPL_MAPPINGS[IMPL_EVM] = 'eth';

// TODO: move into libs
const EC = elliptic.ec;
const secp256k1 = new EC('secp256k1');

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  // TODO: only evm now. cosmos adds the curve property.
  return {
    code: dbNetwork.id,
    feeCode: dbNetwork.id,
    impl: dbNetwork.impl,
    implOptions: {},
    curve: 'secp256k1',
    clients: [{ name: 'Geth', args: [dbNetwork.rpcURL] }],
  };
}

class ProviderController extends BaseProviderController {
  private clients: Record<string, BaseClient> = {};

  private providers: Record<string, BaseProvider> = {};

  constructor(
    private getChainInfoByNetworkId: (networkId: string) => Promise<ChainInfo>,
  ) {
    super((_chainCode) => ({
      code: '',
      feeCode: '',
      impl: '',
      implOptions: {},
      curve: 'secp256k1',
      clients: [],
    }));
  }

  // TODO: set client api to support change.

  async getClient(
    networkId: string,
    filter?: ClientFilter,
  ): Promise<BaseClient> {
    const filterClient = filter || (() => true);

    if (typeof this.clients[networkId] === 'undefined') {
      const chainInfo = await this.getChainInfoByNetworkId(networkId);
      const module = this.requireChainImpl(chainInfo.impl);
      const { name, args } = chainInfo.clients[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof module[name] !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        this.clients[networkId] = new module[name](...args);
        this.clients[networkId].setChainInfo(chainInfo);
      }
    }

    const client = this.clients[networkId];

    if (typeof client !== 'undefined' && filterClient(client)) {
      return Promise.resolve(client);
    }
    return Promise.reject(new OneKeyInternalError('Unable to init client.'));
  }

  async getProvider(networkId: string): Promise<BaseProvider> {
    if (typeof this.providers[networkId] === 'undefined') {
      const chainInfo = await this.getChainInfoByNetworkId(networkId);
      const { Provider } = this.requireChainImpl(chainInfo.impl);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.providers[networkId] = new Provider(
        chainInfo,
        (filter?: ClientFilter) => this.getClient(networkId, filter),
      );
    }

    const provider = this.providers[networkId];
    if (typeof provider !== 'undefined') {
      return Promise.resolve(provider);
    }
    return Promise.reject(new OneKeyInternalError('Unable to init provider.'));
  }

  requireChainImpl(impl: string): any {
    return super.requireChainImpl(IMPL_MAPPINGS[impl] || impl);
  }

  addressFromXpub(networkId: string, xpub: Buffer): Promise<string> {
    return this.addressFromPub(networkId, xpub.slice(-33).toString('hex'));
  }

  addressFromPub(networkId: string, pub: string): Promise<string> {
    return this.pubkeyToAddress(
      networkId,
      {
        getPubkey: (_compressed?: boolean) =>
          Promise.resolve(
            Buffer.from(
              secp256k1
                .keyFromPublic(pub, 'hex')
                .getPublic()
                .encode('hex', false),
              'hex',
            ),
          ), // TODO: honor compressed
        verify: (_digest: Buffer, _signature: Buffer) =>
          Promise.resolve(Buffer.from([])), // Not used.
      },
      undefined,
    );
  }
}

export { fromDBNetworkToChainInfo, ProviderController };
