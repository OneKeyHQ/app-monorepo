import {
  AccountAddress,
  Deserializer,
  Network,
  NetworkToNodeAPI,
  RawTransaction,
  Serializer,
  SignedTransaction,
  SimpleTransaction,
} from '@aptos-labs/ts-sdk';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { get, isArray } from 'lodash';

import {
  type IEncodedTxAptos,
  type ISignMessagePayload,
  type ISignMessageResponse,
} from '@onekeyhq/core/src/chains/aptos/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesAptos } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';
import {
  APTOS_SIGN_MESSAGE_PREFIX,
  buildSimpleTransaction,
  formatSignMessageRequest,
  generateTransferCreateCollection,
  generateTransferCreateNft,
} from '../vaults/impls/aptos/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type VaultAptos from '../vaults/impls/aptos/Vault';
import type {
  AptosSignAndSubmitTransactionInput,
  AptosSignAndSubmitTransactionOutput,
} from '@aptos-labs/wallet-standard';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type IAccountInfo =
  | {
      publicKey: string;
      address: string;
    }
  | undefined;

export function decodeBytesTransaction(txn: any) {
  let bcsTxn: Uint8Array;
  if (isArray(txn)) {
    bcsTxn = Uint8Array.from(txn);
  } else if (typeof txn === 'object') {
    bcsTxn = new Uint8Array(Object.values(txn));
  } else if (typeof txn === 'string') {
    if (txn.indexOf(',') !== -1) {
      bcsTxn = new Uint8Array(txn.split(',').map((item) => parseInt(item, 10)));
    } else {
      bcsTxn = bufferUtils.hexToBytes(txn);
    }
  } else {
    throw new Error('invalidParams');
  }

  return bcsTxn;
}

@backgroundClass()
class ProviderApiAptos extends ProviderApiBase {
  public providerName = IInjectedProviderNames.aptos;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.account({ origin, scope: this.providerName });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const params = await this.network();
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_networkChange',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getNetworkURL() {
    return NetworkToNodeAPI[Network.MAINNET];
  }

  private wrapperConnectAccount(account: IAccountInfo) {
    const status = account ? 200 : 4001;
    return {
      publicKey: hexUtils.addHexPrefix(account?.publicKey ?? ''),
      address: hexUtils.addHexPrefix(account?.address ?? ''),
      'method': 'connected',
      'status': status,
    };
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );

    if (accountsInfo) {
      return this.wrapperConnectAccount({
        publicKey: accountsInfo[0].account.pub ?? '',
        address: accountsInfo[0].account.address,
      });
    }

    await this.backgroundApi.serviceDApp.openConnectionModal(request);

    return this.wrapperConnectAccount(await this.account(request));
  }

  @providerApiMethod()
  public async disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: request.isWalletConnectRequest
        ? 'walletConnect'
        : 'injectedProvider',
    });
  }

  @providerApiMethod()
  public async account(request: IJsBridgeMessagePayload): Promise<
    | {
        publicKey: string;
        address: string;
      }
    | undefined
  > {
    try {
      const accounts =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
          request,
        );
      if (!accounts || accounts.length === 0) {
        return undefined;
      }
      const { account } = accounts[0];

      return {
        publicKey: hexUtils.addHexPrefix(account.pub ?? ''),
        address: hexUtils.addHexPrefix(account.address ?? ''),
      };
    } catch {
      return undefined;
    }
  }

  @providerApiMethod()
  public async network(): Promise<string> {
    return Promise.resolve('Mainnet');
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitTransaction(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAptos,
  ): Promise<string> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const encodeTx = params;

    const accounts = await this.getAccountsInfo(request);
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts');
    }

    const { account, accountInfo } = accounts[0];
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          ...encodeTx,
          ...encodeTx.payload,
        },
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const tx = await this.getTransaction(request, result.txid);

    return Promise.resolve(JSON.stringify(tx));
  }

  private _decodeTxToRawTransaction(txn: string) {
    let bcsTxn: Uint8Array;
    if (txn.indexOf(',') !== -1) {
      bcsTxn = new Uint8Array(txn.split(',').map((item) => parseInt(item, 10)));
    } else {
      bcsTxn = bufferUtils.hexToBytes(txn);
    }

    const deserializer = new Deserializer(bcsTxn);
    const rawTxn = RawTransaction.deserialize(deserializer);

    let feePayerAddress;
    try {
      const feePayerPresent = deserializer.deserializeBool();
      if (feePayerPresent) {
        feePayerAddress = AccountAddress.deserialize(deserializer);
      }
    } catch {
      // ignore
    }

    const simpleTxn = new SimpleTransaction(rawTxn, feePayerAddress);
    return {
      rawTxn: simpleTxn,
      hexBcsTxn: simpleTxn.bcsToHex().toStringWithoutPrefix(),
    };
  }

  private _convertRawTransactionToEncodeTx(
    transaction: SimpleTransaction,
    hexBcsTxn: string,
  ): IEncodedTxAptos {
    const payload = transaction.rawTransaction.payload;

    if (get(payload, 'entryFunction', null)) {
      return {
        type: 'entry_function_payload',
        bcsTxn: hexBcsTxn,
      };
    }

    throw new Error(`not support transaction type`);
  }

  private async _getAccount(request: IJsBridgeMessagePayload) {
    const accounts = await this.getAccountsInfo(request);
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts');
    }

    return accounts[0];
  }

  private async _getAccountByAddress(
    request: IJsBridgeMessagePayload,
    address: string,
  ) {
    const accounts = (await this.getAccountsInfo(request)).filter(
      (account) =>
        hexUtils.stripHexPrefix(account.account.address.toLowerCase()) ===
        hexUtils.stripHexPrefix(address).toLowerCase(),
    );
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts');
    }

    return accounts[0];
  }

  @permissionRequired()
  @providerApiMethod()
  public async martianSignAndSubmitTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ): Promise<string> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo } = await this._getAccount(request);

    const { rawTxn, hexBcsTxn } = this._decodeTxToRawTransaction(params);
    const encodeTx = this._convertRawTransactionToEncodeTx(rawTxn, hexBcsTxn);

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return result.txid;
  }

  @permissionRequired()
  @providerApiMethod()
  public async martianSignTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo } = await this._getAccount(request);

    const { rawTxn, hexBcsTxn } = this._decodeTxToRawTransaction(params);
    const encodeTx = this._convertRawTransactionToEncodeTx(rawTxn, hexBcsTxn);

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const simpleTxn = SimpleTransaction.deserialize(
      new Deserializer(
        Buffer.from(hexUtils.stripHexPrefix(result.rawTx), 'hex'),
      ),
    );

    return Promise.resolve(
      bufferUtils
        .hexToBytes(simpleTxn.bcsToHex().toStringWithoutPrefix())
        .toString(),
    );
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAptos,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo } = await this._getAccount(request);
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: params,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return result.rawTx;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransactionV2(
    request: IJsBridgeMessagePayload,
    params: {
      transaction: string;
      transactionType: 'simple' | 'multi_agent';
      asFeePayer?: boolean;
    },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });

    if (params.transactionType === 'multi_agent') {
      throw new Error('Not implemented MultiAgentTransaction');
    }
    const txnBsc = params.transaction;

    const { rawTxn, hexBcsTxn } = this._decodeTxToRawTransaction(txnBsc);

    const { account, accountInfo } = await this._getAccountByAddress(
      request,
      rawTxn.rawTransaction.sender.bcsToHex().toStringWithoutPrefix(),
    );
    const encodeTx = this._convertRawTransactionToEncodeTx(rawTxn, hexBcsTxn);
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          ...encodeTx,
          max_gas_amount: rawTxn.rawTransaction.max_gas_amount.toString(),
          gas_unit_price: rawTxn.rawTransaction.gas_unit_price.toString(),
          disableEditTx: true,
        },
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    const signedTxn = SignedTransaction.deserialize(
      new Deserializer(
        Buffer.from(hexUtils.stripHexPrefix(result.rawTx), 'hex'),
      ),
    );

    let type = 'ed25519';
    let signature;
    const authenticator = signedTxn.authenticator;
    if (authenticator.isEd25519()) {
      type = 'ed25519';
      signature = bufferUtils.bytesToHex(
        authenticator.signature.toUint8Array(),
      );
    }

    return {
      type,
      signature,
      publicKey: account.pub,
    };
  }

  @providerApiMethod()
  public async signAndSubmitTransactionV2(
    request: IJsBridgeMessagePayload,
    params: string,
  ): Promise<AptosSignAndSubmitTransactionOutput> {
    const { account, accountInfo } = await this._getAccount(request);

    const input = JSON.parse(params) as AptosSignAndSubmitTransactionInput;
    const vault = await this.getAptosVault(request);

    const rawTx = await buildSimpleTransaction(
      vault.client,
      account.address,
      input,
    );

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: {
          type: 'entry_function_payload',
          bcsTxn: rawTx.bcsToHex().toStringWithoutPrefix(),
          max_gas_amount: rawTx.rawTransaction.max_gas_amount.toString(),
          gas_unit_price: rawTx.rawTransaction.gas_unit_price.toString(),
        },
        signOnly: false,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return {
      hash: result.txid,
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessagePayload,
  ): Promise<ISignMessageResponse> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    // @ts-expect-error
    const isPetra = request.data?.aptosProviderType === 'petra';

    const { account, accountInfo } = await this._getAccount(request);

    const { chainId } = await this.getChainId(request);

    const format = formatSignMessageRequest(
      params,
      account?.address ?? '',
      request.origin ?? '',
      chainId,
    );

    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesAptos.SIGN_MESSAGE,
        message: format.fullMessage,
        payload: format,
      },
      accountId: account.id ?? '',
      networkId: accountInfo?.networkId ?? '',
    })) as string;

    return Promise.resolve({
      ...format,
      prefix: APTOS_SIGN_MESSAGE_PREFIX,
      signature: isPetra ? hexUtils.stripHexPrefix(result) : result,
    });
  }

  @providerApiMethod()
  public async signGenericTransaction(
    request: IJsBridgeMessagePayload,
    params: {
      func: string;
      args: any[];
      type_args: any[];
    },
  ): Promise<string> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const encodeTx: IEncodedTxAptos = {
      type: 'entry_function_payload',
      function: params.func,
      arguments: params.args,
      type_arguments: params.type_args,
    };

    const { account, accountInfo } = await this._getAccount(request);
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return result.txid;
  }

  @providerApiMethod()
  public async createCollection(
    request: IJsBridgeMessagePayload,
    params: {
      name: string;
      description: string;
      uri: string;
      maxAmount: string;
    },
  ) {
    const { account, accountInfo } = await this._getAccount(request);

    const encodeTx = generateTransferCreateCollection(
      params.name,
      params.description,
      params.uri,
    );

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return result.txid;
  }

  @providerApiMethod()
  public async createToken(
    request: IJsBridgeMessagePayload,
    params: {
      collectionName: string;
      name: string;
      description: string;
      supply: number;
      uri: string;
      max?: string;
      royalty_payee_address?: string;
      royalty_points_denominator?: number;
      royalty_points_numerator?: number;
      property_keys?: Array<string>;
      property_values?: Array<string>;
      property_types?: Array<string>;
    },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo } = await this._getAccount(request);
    const encodeTx = generateTransferCreateNft(
      account.address,
      params.collectionName,
      params.name,
      params.description,
      params.supply,
      params.uri,
      BigInt(params.max ?? 9_007_199_254_740_991),
      params.royalty_payee_address,
      params.royalty_points_denominator,
      params.royalty_points_numerator,
      params.property_keys,
      params.property_values,
      params.property_types,
    );

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      });

    return Promise.resolve(result.txid);
  }

  private async getAptosVault(
    request: IJsBridgeMessagePayload,
  ): Promise<VaultAptos> {
    const { account, accountInfo } = await this._getAccount(request);
    const vault = (await vaultFactory.getVault({
      networkId: accountInfo?.networkId ?? '',
      accountId: account.id,
    })) as VaultAptos;

    return vault;
  }

  @providerApiMethod()
  public async getChainId(request: IJsBridgeMessagePayload) {
    const vault = await this.getAptosVault(request);

    const chainId = await vault.client.getChainId();
    return Promise.resolve({ chainId });
  }

  @providerApiMethod()
  public async generateTransaction(
    request: IJsBridgeMessagePayload,
    params: {
      sender: string;
      payload: {
        function: string;
        type_arguments: any[];
        arguments: any[];
      };
      options?: {
        sender?: string;
        sequence_number?: string;
        max_gas_amount?: string;
        gas_unit_price?: string;
        gas_currency_code?: string; // TODO:Unix timestamp, in seconds + 10 seconds
        expiration_timestamp_secs?: string;
      };
    },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const vault = await this.getAptosVault(request);
    const rawTx = await vault.client.aptos.transaction.build.simple({
      sender: params.sender,
      data: {
        function: params.payload.function as `${string}::${string}::${string}`,
        typeArguments: params.payload.type_arguments,
        functionArguments: params.payload.arguments,
      },
      options: {
        maxGasAmount: params.options?.max_gas_amount
          ? Number(params.options.max_gas_amount)
          : undefined,
        gasUnitPrice: params.options?.gas_unit_price
          ? Number(params.options.gas_unit_price)
          : undefined,
        accountSequenceNumber: params.options?.sequence_number
          ? BigInt(params.options.sequence_number)
          : undefined,
        expireTimestamp: params.options?.expiration_timestamp_secs
          ? Number(params.options.expiration_timestamp_secs)
          : undefined,
      },
    });
    const serializer = new Serializer();
    rawTx.rawTransaction.serialize(serializer);
    return serializer.toUint8Array().toString();
  }

  @providerApiMethod()
  public async submitTransaction(
    request: IJsBridgeMessagePayload,
    params: Uint8Array | string,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { account, accountInfo } = await this._getAccount(request);
    const bcsTxn: Uint8Array = decodeBytesTransaction(params);
    const encodedTx = {
      bcsTxn: bufferUtils.bytesToHex(bcsTxn),
    } as IEncodedTxAptos;
    const res = await this.backgroundApi.serviceSend.broadcastTransaction({
      signedTx: {
        encodedTx,
        txid: '',
        rawTx: bufferUtils.bytesToHex(bcsTxn),
      },
      accountAddress: account.address,
      accountId: accountInfo?.accountId ?? '',
      networkId: accountInfo?.networkId ?? '',
    });
    return res;
  }

  @providerApiMethod()
  public async getTransactions(
    request: IJsBridgeMessagePayload,
    params: { start?: string; limit?: number },
  ) {
    const vault = await this.getAptosVault(request);
    const { start } = params ?? {};
    return vault.client.getTransactions({
      offset: start ? BigInt(start) : undefined,
      limit: params.limit,
    });
  }

  @providerApiMethod()
  public async getTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ) {
    const vault = await this.getAptosVault(request);
    return vault.client.getTransactionByHash(params);
  }

  @providerApiMethod()
  public async getAccountTransactions(
    request: IJsBridgeMessagePayload,
    params: {
      accountAddress: string;
      query?: { start?: string; limit?: number };
    },
  ) {
    const vault = await this.getAptosVault(request);
    const { start } = params.query ?? {};
    return vault.client.getAccountTransactions(params.accountAddress, {
      offset: start ? BigInt(start) : undefined,
      limit: params.query?.limit,
    });
  }

  @providerApiMethod()
  public async getAccountResources(
    request: IJsBridgeMessagePayload,
    params: {
      accountAddress: string;
      query?: { ledgerVersion?: string };
    },
  ) {
    const vault = await this.getAptosVault(request);
    const { ledgerVersion } = params.query ?? {};

    return vault.client.getAccountResources(params.accountAddress, {
      ledgerVersion: ledgerVersion ? BigInt(ledgerVersion) : undefined,
    });
  }

  @providerApiMethod()
  public async getAccount(request: IJsBridgeMessagePayload, params: string) {
    const vault = await this.getAptosVault(request);
    return vault.client.getAccount(params);
  }

  @providerApiMethod()
  public async getLedgerInfo(request: IJsBridgeMessagePayload) {
    const vault = await this.getAptosVault(request);
    return vault.client.getLedgerInfo();
  }
}

export default ProviderApiAptos;
