/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line max-classes-per-file
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
import {
  HardwareError,
  NotImplementedError,
} from '@onekeyhq/shared/src/errors/common-errors';

import type BigNumber from 'bignumber.js';

abstract class BaseClient {
  chainInfo?: ChainInfo;

  setChainInfo(chainInfo: ChainInfo) {
    this.chainInfo = chainInfo;
  }

  abstract getInfo(): Promise<ClientInfo>;

  abstract getAddresses(
    addresses: Array<string>,
  ): Promise<Array<AddressInfo | undefined>>;

  abstract getBalances(
    requests: Array<{ address: string; coin: Partial<CoinInfo> }>,
  ): Promise<Array<BigNumber | undefined>>;

  abstract getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>>;

  abstract getFeePricePerUnit(): Promise<FeePricePerUnit>;

  abstract broadcastTransaction(rawTx: string, options?: any): Promise<string>;

  getTokenInfos(
    tokenAddresses: Array<string>,
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return Promise.reject(NotImplementedError);
  }

  getUTXOs(addresses: Array<string>): Promise<{ [address: string]: UTXO[] }> {
    return Promise.reject(NotImplementedError);
  }
}

abstract class SimpleClient extends BaseClient {
  async batchCall2SingleCall<T, R>(
    inputs: T[],
    handler: (input: T) => Promise<R | undefined>,
  ): Promise<Array<R | undefined>> {
    const ret = await Promise.all(
      inputs.map((input) =>
        handler(input).then(
          (value) => value,
          (reason) => {
            console.debug(
              `Error in Calling ${handler.name}. `,
              ' input: ',
              input,
              ', reason',
              reason,
            );
            return undefined;
          },
        ),
      ),
    );
    return ret;
  }

  async getAddresses(
    addresses: Array<string>,
  ): Promise<Array<AddressInfo | undefined>> {
    return this.batchCall2SingleCall(addresses, (i) => this.getAddress(i));
  }

  abstract getAddress(address: string): Promise<AddressInfo>;

  getBalances(
    requests: Array<{ address: string; coin: Partial<CoinInfo> }>,
  ): Promise<Array<BigNumber | undefined>> {
    return this.batchCall2SingleCall(requests, (i) =>
      this.getBalance(i.address, i.coin),
    );
  }

  getBalance(address: string, coin: Partial<CoinInfo>): Promise<BigNumber> {
    return this.getAddress(address).then((res) => res.balance);
  }

  getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    return this.batchCall2SingleCall(txids, (i) =>
      this.getTransactionStatus(i),
    );
  }

  abstract getTransactionStatus(txid: string): Promise<TransactionStatus>;

  override getTokenInfos(
    tokenAddresses: Array<string>,
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.batchCall2SingleCall(tokenAddresses, (i) =>
      this.getTokenInfo(i),
    );
  }

  getTokenInfo(tokenAddress: string): Promise<PartialTokenInfo | undefined> {
    return Promise.reject(NotImplementedError);
  }

  override async getUTXOs(
    addresses: Array<string>,
  ): Promise<{ [address: string]: UTXO[] }> {
    const result = await this.batchCall2SingleCall(addresses, (i) =>
      this.getUTXO(i),
    );
    return result.reduce<{ [address: string]: UTXO[] }>((acc, utxos, index) => {
      const curAddress = addresses[index];
      acc[curAddress] = utxos || [];
      return acc;
    }, {});
  }

  getUTXO(address: string): Promise<UTXO[]> {
    return Promise.reject(NotImplementedError);
  }
}

export type ClientFilter = <T extends BaseClient>(client: T) => boolean;

abstract class BaseProvider {
  readonly chainInfo: ChainInfo;

  readonly clientSelector: <T extends BaseClient>(
    filter?: ClientFilter,
  ) => Promise<T>;

  constructor(
    chainInfo: ChainInfo,
    clientSelector: <T extends BaseClient>(filter?: ClientFilter) => Promise<T>,
  ) {
    this.chainInfo = chainInfo;
    this.clientSelector = clientSelector;
  }

  abstract pubkeyToAddress(
    verifier: Verifier,
    encoding?: string,
  ): Promise<string>;

  abstract verifyAddress(address: string): Promise<AddressValidation>;

  abstract buildUnsignedTx(unsignedTx: UnsignedTx): Promise<UnsignedTx>;

  abstract signTransaction(
    unsignedTx: UnsignedTx,
    signers: { [p: string]: Signer },
  ): Promise<SignedTx>;

  verifyTokenAddress(address: string): Promise<AddressValidation> {
    return this.verifyAddress(address);
  }

  signMessage(
    message: TypedMessage,
    signer: Signer,
    address?: string,
  ): Promise<string> {
    return Promise.reject(NotImplementedError);
  }

  verifyMessage(
    address: string,
    message: TypedMessage,
    signature: string,
  ): Promise<boolean> {
    return Promise.reject(NotImplementedError);
  }
}

export { BaseClient, SimpleClient, BaseProvider };
