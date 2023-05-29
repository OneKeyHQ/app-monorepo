/* eslint-disable max-classes-per-file,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unused-vars */
import {
  BaseProvider,
  SimpleClient,
} from '@onekeyhq/engine/src/client/BaseClient';
import type {
  BaseClient,
  ClientFilter,
} from '@onekeyhq/engine/src/client/BaseClient';
import type { ChainInfo, CoinInfo } from '@onekeyhq/engine/src/types/chain';
import type {
  AddressInfo,
  AddressValidation,
  ClientInfo,
  FeePricePerUnit,
  PartialTokenInfo,
  SignedTx,
  TransactionStatus,
  TypedMessage,
  UTXO,
  UnsignedTx,
} from '@onekeyhq/engine/src/types/provider';
import type { Signer, Verifier } from '@onekeyhq/engine/src/types/secret';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  createAnyPromise,
  createDelayPromise,
} from '@onekeyhq/shared/src/utils/promiseUtils';

import type BigNumber from 'bignumber.js';

class MockClient extends SimpleClient {
  broadcastTransaction(rawTx: string, options?: any): Promise<string> {
    console.error(
      'Calling MockClient, please implement method in Vaults directly',
    );
    return Promise.resolve('');
  }

  getAddress(address: string): Promise<AddressInfo> {
    console.error(
      'Calling MockClient, please implement method in Vaults directly',
    );
    return Promise.resolve(undefined as any);
  }

  getFeePricePerUnit(): Promise<FeePricePerUnit> {
    console.error(
      'Calling MockClient, please implement method in Vaults directly',
    );
    return Promise.resolve(undefined as any);
  }

  getInfo(): Promise<ClientInfo> {
    console.error(
      'Calling MockClient, please implement method in Vaults directly',
    );
    return Promise.resolve(undefined as any);
  }

  getTransactionStatus(txid: string): Promise<TransactionStatus> {
    console.error(
      'Calling MockClient, please implement method in Vaults directly',
    );
    return Promise.resolve(undefined as any);
  }
}

class MockProvider extends BaseProvider {
  buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx> {
    console.error(
      'Calling MockProvider, please implement method in Vaults directly',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(undefined as any);
  }

  pubkeyToAddress(verifier: Verifier, encoding?: string): Promise<string> {
    console.error(
      'Calling MockProvider, please implement method in Vaults directly',
    );
    return Promise.resolve('');
  }

  signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    console.error(
      'Calling MockProvider, please implement method in Vaults directly',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(undefined as any);
  }

  verifyAddress(address: string): Promise<AddressValidation> {
    console.error(
      'Calling MockProvider, please implement method in Vaults directly',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(undefined as any);
  }
}
const mockProvider = {
  Provider: MockProvider,
  Client: MockClient,
};
const IMPLS: { [key: string]: any } = {
  algo: mockProvider,
  ada: mockProvider,
  cosmos: mockProvider,
  cfx: require('./chains/cfx'),
  eth: require('./chains/eth'),
  near: mockProvider,
  sol: require('./chains/sol'),
  stc: require('./chains/stc'),
  btc: mockProvider,
  tbtc: mockProvider,
  bch: mockProvider,
  ltc: mockProvider,
  doge: mockProvider,
  btg: mockProvider,
  dgb: mockProvider,
  xrp: mockProvider,
  nmc: mockProvider,
  vtc: mockProvider,
  dash: mockProvider,
  dot: mockProvider,
  sui: mockProvider,
  apt: mockProvider,
  xmr: mockProvider,
  fil: mockProvider,
  tron: mockProvider,
  kaspa: mockProvider,
};

class ProviderController {
  chainSelector: (chainCode: string) => ChainInfo;

  private clientsCache: { [chainCode: string]: Array<BaseClient> } = {};

  private lastClientCache: { [chainCode: string]: [BaseClient, number] } = {};

  constructor(chainSelector: (chainCode: string) => ChainInfo) {
    this.chainSelector = chainSelector;
  }

  // TODO legacy getRpcClient
  async getClient(
    chainCode: string,
    filter?: ClientFilter,
  ): Promise<BaseClient> {
    // eslint-disable-next-line no-param-reassign
    filter = filter || (() => true);
    const [lastClient, expiredAt] = this.lastClientCache[chainCode] || [];

    if (
      typeof lastClient !== 'undefined' &&
      expiredAt <= Date.now() &&
      filter(lastClient)
    ) {
      return Promise.resolve(lastClient);
    }

    let clients = this.clientsCache[chainCode];

    if (!clients || clients.length === 0) {
      const chainInfo = this.chainSelector(chainCode);

      const module: any = this.requireChainImpl(chainInfo.impl);
      clients = chainInfo.clients
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
        .map((config) => [module[config.name], config])
        .filter(([clazz, _]) => typeof clazz !== 'undefined')
        // eslint-disable-next-line new-cap,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
        .map(([clazz, config]) => new clazz(...config.args));

      for (const client of clients) {
        client.setChainInfo(chainInfo);
      }
      this.clientsCache[chainCode] = clients;
    }

    let client: BaseClient | undefined;

    try {
      client = await Promise.race([
        createAnyPromise(
          clients.filter(filter).map(async (candidate) => {
            const info = await candidate.getInfo();

            if (!info.isReady) {
              throw Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `${candidate.constructor.name}<${candidate}> is not ready.`,
              );
            }

            return candidate;
          }),
        ),
        createDelayPromise(10000, undefined),
      ]);
    } catch (e) {
      console.error(e);
    }

    if (typeof client === 'undefined') {
      throw Error('No available client');
    }

    this.lastClientCache[chainCode] = [client, Date.now() + 300000]; // Expired at 5 minutes
    return client;
  }

  getProvider(chainCode: string): Promise<BaseProvider> {
    const chainInfo = this.chainSelector(chainCode);
    const { Provider } = this.requireChainImpl(chainInfo.impl);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      new Provider(chainInfo, (filter?: ClientFilter) =>
        this.getClient(chainCode, filter),
      ),
    );
  }

  requireChainImpl(impl: string): any {
    return checkIsDefined(IMPLS[impl]);
  }

  getInfo(chainCode: string): Promise<ClientInfo> {
    return this.getClient(chainCode).then((client) => client.getInfo());
  }

  getAddresses(
    chainCode: string,
    address: Array<string>,
  ): Promise<Array<AddressInfo | undefined>> {
    return this.getClient(chainCode).then((client) =>
      client.getAddresses(address),
    );
  }

  async getBalances(
    chainCode: string,
    requests: Array<{ address: string; coin: Partial<CoinInfo> }>,
  ): Promise<Array<BigNumber | undefined>> {
    return this.getClient(chainCode).then((client) =>
      client.getBalances(requests),
    );
  }

  getTransactionStatuses(
    chainCode: string,
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    return this.getClient(chainCode).then((client) =>
      client.getTransactionStatuses(txids),
    );
  }

  getFeePricePerUnit(chainCode: string): Promise<FeePricePerUnit> {
    return this.getClient(chainCode).then((client) =>
      client.getFeePricePerUnit(),
    );
  }

  broadcastTransaction(
    chainCode: string,
    rawTx: string,
    options?: any,
  ): Promise<string> {
    return this.getClient(chainCode).then((client) =>
      client.broadcastTransaction(rawTx, options),
    );
  }

  getTokenInfos(
    chainCode: string,
    tokenAddresses: Array<string>,
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.getClient(chainCode).then((client) =>
      client.getTokenInfos(tokenAddresses),
    );
  }

  getUTXOs(
    chainCode: string,
    address: Array<string>,
  ): Promise<{ [address: string]: Array<UTXO> }> {
    return this.getClient(chainCode).then((provider) =>
      provider.getUTXOs(address),
    );
  }

  buildUnsignedTx(
    chainCode: string,
    unsignedTx: UnsignedTx,
  ): Promise<UnsignedTx> {
    return this.getProvider(chainCode).then((provider) =>
      provider.buildUnsignedTx(unsignedTx),
    );
  }

  pubkeyToAddress(
    chainCode: string,
    verifier: Verifier,
    encoding: string | undefined,
  ): Promise<string> {
    return this.getProvider(chainCode).then((provider) =>
      provider.pubkeyToAddress(verifier, encoding),
    );
  }

  signTransaction(
    chainCode: string,
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx> {
    return this.getProvider(chainCode).then((provider) =>
      provider.signTransaction(unsignedTx, signers),
    );
  }

  verifyAddress(
    chainCode: string,
    address: string,
  ): Promise<AddressValidation> {
    return this.getProvider(chainCode).then((provider) =>
      provider.verifyAddress(address),
    );
  }

  verifyTokenAddress(
    chainCode: string,
    address: string,
  ): Promise<AddressValidation> {
    return this.getProvider(chainCode).then((provider) =>
      provider.verifyTokenAddress(address),
    );
  }

  signMessage(
    chainCode: string,
    message: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> {
    return this.getProvider(chainCode).then((provider) =>
      provider.signMessage(message, signer, address),
    );
  }

  verifyMessage(
    chainCode: string,
    address: string,
    message: TypedMessage,
    signature: string,
  ): Promise<boolean> {
    return this.getProvider(chainCode).then((provider) =>
      provider.verifyMessage(address, message, signature),
    );
  }
}

export { ProviderController };
