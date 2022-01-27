/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { Buffer } from 'buffer';

import { ProviderController as BaseProviderController } from '@onekeyhq/blockchain-libs/dist/provider';
import {
  BaseClient,
  BaseProvider,
  ClientFilter,
} from '@onekeyhq/blockchain-libs/dist/provider/abc';
import { uncompressPublicKey } from '@onekeyhq/blockchain-libs/dist/secret';
import { ChainInfo } from '@onekeyhq/blockchain-libs/dist/types/chain';
import { Verifier } from '@onekeyhq/blockchain-libs/dist/types/secret';

import { IMPL_EVM, IMPL_SOL } from './constants';
import { OneKeyInternalError } from './errors';
import { DBNetwork } from './types/network';

// IMPL naming aren't necessarily the same.
const IMPL_MAPPINGS: Record<string, string> = {
  [IMPL_EVM]: 'eth',
  [IMPL_SOL]: 'sol',
};

type Curve = 'secp256k1' | 'ed25519';

type ImplProperty = {
  defaultCurve: Curve;
  clientProvider: string;
  implOptions?: { [key: string]: any };
};

const IMPL_PROPERTIES: Record<string, ImplProperty> = {
  [IMPL_EVM]: {
    defaultCurve: 'secp256k1',
    clientProvider: 'Geth',
  },
  [IMPL_SOL]: {
    defaultCurve: 'ed25519',
    clientProvider: 'Solana',
  },
};

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  const implProperties = IMPL_PROPERTIES[dbNetwork.impl];
  if (typeof implProperties === 'undefined') {
    throw new OneKeyInternalError('Unable to build chain info from dbNetwork.');
  }
  return {
    code: dbNetwork.id,
    feeCode: dbNetwork.id,
    impl: dbNetwork.impl,
    implOptions: implProperties.implOptions || {},
    curve: (dbNetwork.curve as Curve) || implProperties.defaultCurve,
    clients: [
      { name: implProperties.clientProvider, args: [dbNetwork.rpcURL] },
    ],
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

  private getVerifier(networkId: string, pub: string): Verifier {
    const provider = this.providers[networkId];
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }
    const { chainInfo } = this.providers[networkId];
    const implProperties = IMPL_PROPERTIES[chainInfo.impl];
    const curve = chainInfo.curve || implProperties.defaultCurve;
    return {
      getPubkey: (compressed?: boolean) =>
        Promise.resolve(
          compressed
            ? Buffer.from(pub, 'hex')
            : uncompressPublicKey(curve, Buffer.from(pub, 'hex')),
        ),
      verify: (_digest: Buffer, _signature: Buffer) =>
        Promise.resolve(Buffer.from([])), // Not used.
    };
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

  async addressFromPub(networkId: string, pub: string): Promise<string> {
    await this.getProvider(networkId);
    return this.pubkeyToAddress(
      networkId,
      this.getVerifier(networkId, pub),
      undefined,
    );
  }
}

export { fromDBNetworkToChainInfo, ProviderController };
