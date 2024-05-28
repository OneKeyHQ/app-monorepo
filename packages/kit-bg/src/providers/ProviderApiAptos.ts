import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { BCS, Network, NetworkToNodeAPI, TxnBuilderTypes } from 'aptos';
import { isArray } from 'lodash';

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
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesAptos } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';
import {
  APTOS_SIGN_MESSAGE_PREFIX,
  formatSignMessageRequest,
  generateTransferCreateCollection,
  generateTransferCreateNft,
  transactionPayloadToTxPayload,
} from '../vaults/impls/aptos/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type VaultAptos from '../vaults/impls/aptos/Vault';
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
      const params = await this.account({ origin, scope: 'aptos' });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, origin);
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
      ...account,
      'method': 'connected',
      'status': status,
    };
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
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
    const accounts = await this.getAccountsInfo(request);
    if (!accounts || accounts.length === 0) {
      return undefined;
    }
    const { account } = accounts[0];

    return {
      publicKey: account.pub ?? '',
      address: account.address,
    };
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
    const encodeTx = params;

    const accounts = await this.getAccountsInfo(request);
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts');
    }

    const { account, accountInfo } = accounts[0];
    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    const tx = await this.getTransaction(request, result);

    return Promise.resolve(JSON.stringify(tx));
  }

  private _decodeTxToRawTransaction(txn: string) {
    let bcsTxn: Uint8Array;
    if (txn.indexOf(',') !== -1) {
      bcsTxn = new Uint8Array(txn.split(',').map((item) => parseInt(item, 10)));
    } else {
      bcsTxn = bufferUtils.hexToBytes(txn);
    }

    const deserializer = new BCS.Deserializer(bcsTxn);
    const rawTxn = TxnBuilderTypes.RawTransaction.deserialize(deserializer);

    return {
      rawTxn,
      hexBcsTxn: bufferUtils.bytesToHex(bcsTxn),
    };
  }

  private async _convertRawTransactionToEncodeTx(
    transaction: TxnBuilderTypes.RawTransaction,
    hexBcsTxn: string,
    vault: VaultAptos,
  ) {
    const payload = await transactionPayloadToTxPayload(
      vault.client,
      // @ts-expect-error
      transaction.payload.value,
    );

    return {
      sender: hexUtils.hexlify(transaction?.sender?.address),
      sequence_number: transaction?.sequence_number?.toString(),
      max_gas_amount: transaction?.max_gas_amount?.toString(),
      gas_unit_price: transaction?.gas_unit_price?.toString(),
      expiration_timestamp_secs:
        transaction?.expiration_timestamp_secs?.toString(),
      chain_id: transaction?.chain_id?.value,

      bscTxn: hexBcsTxn,

      ...payload,
      // todo: codes
    };
  }

  private async _getAccount(request: IJsBridgeMessagePayload) {
    const accounts = await this.getAccountsInfo(request);
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
    const { account, accountInfo } = await this._getAccount(request);
    const vault = await this.getAptosVault(request);

    const { rawTxn, hexBcsTxn } = this._decodeTxToRawTransaction(params);
    const encodeTx = await this._convertRawTransactionToEncodeTx(
      rawTxn,
      hexBcsTxn,
      vault,
    );

    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return result;
  }

  @permissionRequired()
  @providerApiMethod()
  public async martianSignTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ) {
    const { account, accountInfo } = await this._getAccount(request);
    const vault = await this.getAptosVault(request);

    const { rawTxn, hexBcsTxn } = this._decodeTxToRawTransaction(params);
    const encodeTx = await this._convertRawTransactionToEncodeTx(
      rawTxn,
      hexBcsTxn,
      vault,
    );

    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return Promise.resolve(
      bufferUtils.hexToBytes(hexUtils.stripHexPrefix(result)).toString(),
    );
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAptos,
  ) {
    const { account, accountInfo } = await this._getAccount(request);
    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: params,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return result;
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessagePayload,
  ): Promise<ISignMessageResponse> {
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
    const encodeTx: IEncodedTxAptos = {
      type: 'entry_function_payload',
      function: params.func,
      arguments: params.args,
      type_arguments: params.type_args,
    };

    const { account, accountInfo } = await this._getAccount(request);
    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return result;
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
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return result;
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
    const { account, accountInfo } = await this._getAccount(request);
    const encodeTx = generateTransferCreateNft(
      account.address,
      params.collectionName,
      params.name,
      params.description,
      params.supply,
      params.uri,
      BigInt(params.max ?? 9007199254740991),
      params.royalty_payee_address,
      params.royalty_points_denominator,
      params.royalty_points_numerator,
      params.property_keys,
      params.property_values,
      params.property_types,
    );

    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as string;

    return Promise.resolve(result);
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
    const vault = await this.getAptosVault(request);
    const rawTx = await vault.client.generateTransaction(
      params.sender,
      params.payload,
      params.options,
    );
    const serializer = new BCS.Serializer();
    rawTx.serialize(serializer);
    return serializer.getBytes().toString();
  }

  @providerApiMethod()
  public async submitTransaction(
    request: IJsBridgeMessagePayload,
    params: Uint8Array | string,
  ) {
    const { account, accountInfo } = await this._getAccount(request);
    const bcsTxn: Uint8Array = decodeBytesTransaction(params);
    const encodedTx = {
      bscTxn: bufferUtils.bytesToHex(bcsTxn),
    } as IEncodedTxAptos;
    const res = await this.backgroundApi.serviceSend.broadcastTransaction({
      signedTx: {
        encodedTx,
        txid: '',
        rawTx: bufferUtils.bytesToHex(bcsTxn),
      },
      accountAddress: account.address,
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
      start: start ? BigInt(start) : undefined,
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
      start: start ? BigInt(start) : undefined,
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
