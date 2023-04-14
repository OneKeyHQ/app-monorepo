/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { BCS, TxnBuilderTypes } from 'aptos';
import { isArray } from 'lodash';

import { AptosMessageTypes } from '@onekeyhq/engine/src/types/message';
import type {
  IEncodedTxAptos,
  SignMessagePayload,
  SignMessageResponse,
} from '@onekeyhq/engine/src/vaults/impl/apt/types';
import {
  APTOS_SIGN_MESSAGE_PREFIX,
  formatSignMessageRequest,
  generateTransferCreateCollection,
  generateTransferCreateNft,
  transactionPayloadToTxPayload,
} from '@onekeyhq/engine/src/vaults/impl/apt/utils';
import type VaultAptos from '@onekeyhq/engine/src/vaults/impl/apt/Vault';
import {
  hexlify,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_APTOS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type AccountInfo =
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
      bcsTxn = hexToBytes(txn);
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
      const params = await this.account({ origin });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data);
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
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getNetworkURL() {
    const { networkId } = getActiveWalletAccount();
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    return network.rpcURL;
  }

  private wrapperConnectAccount(account: AccountInfo) {
    const status = account ? 200 : 4001;
    return {
      ...account,
      'method': 'connected',
      'status': status,
    };
  }

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info('aptos connect', request);
    const account = await this.account(request);

    if (account) {
      return this.wrapperConnectAccount(account);
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);

    return this.wrapperConnectAccount(await this.account(request));
  }

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_APTOS,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_APTOS })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('aptos disconnect', origin);
  }

  @providerApiMethod()
  public async account(request: IJsBridgeMessagePayload): Promise<
    | {
        publicKey: string;
        address: string;
      }
    | undefined
  > {
    debugLogger.providerApi.info('aptos account');
    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_APTOS) {
      return undefined;
    }

    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_APTOS,
      });
    if (!connectedAccounts) {
      return undefined;
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;
    const address = await vault.getAccountAddress();

    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(address)) {
      return undefined;
    }

    const publicKey = await vault._getPublicKey();
    return Promise.resolve({ publicKey, address });
  }

  @providerApiMethod()
  public async network(): Promise<string> {
    debugLogger.providerApi.info('aptos network');
    const { networkId } = getActiveWalletAccount();
    const network = await this.backgroundApi.engine.getNetwork(networkId);

    return Promise.resolve(network.isTestnet ? 'Testnet' : 'Mainnet');
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndSubmitTransaction(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAptos,
  ): Promise<string> {
    debugLogger.providerApi.info('aptos signAndSubmitTransaction', params);
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const encodeTx = params;

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    const tx = await vault.getTransactionByHash(result);

    return Promise.resolve(JSON.stringify(tx));
  }

  private _decodeTnxToRawTransaction(txn: string) {
    let bcsTxn: Uint8Array;
    if (txn.indexOf(',') !== -1) {
      bcsTxn = new Uint8Array(txn.split(',').map((item) => parseInt(item, 10)));
    } else {
      bcsTxn = hexToBytes(txn);
    }

    const deserializer = new BCS.Deserializer(bcsTxn);
    const rawTxn = TxnBuilderTypes.RawTransaction.deserialize(deserializer);

    return {
      rawTxn,
      hexBcsTxn: bytesToHex(bcsTxn),
    };
  }

  private async _convertRawTransactionToEncodeTx(
    transaction: TxnBuilderTypes.RawTransaction,
    hexBcsTxn: string,
    vault: VaultAptos,
  ) {
    const payload = await transactionPayloadToTxPayload(
      await vault.getClient(),
      // @ts-expect-error
      transaction.payload.value,
    );

    return {
      sender: hexlify(transaction?.sender?.address),
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

  @permissionRequired()
  @providerApiMethod()
  public async martianSignAndSubmitTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ): Promise<string> {
    debugLogger.providerApi.info(
      'aptos martianSignAndSubmitTransaction',
      params,
    );
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const { rawTxn, hexBcsTxn } = this._decodeTnxToRawTransaction(params);
    const encodeTx = await this._convertRawTransactionToEncodeTx(
      rawTxn,
      hexBcsTxn,
      vault,
    );

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    return Promise.resolve(result);
  }

  @permissionRequired()
  @providerApiMethod()
  public async martianSignTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ) {
    debugLogger.providerApi.info('aptos martianSignTransaction', params);
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const { rawTxn, hexBcsTxn } = this._decodeTnxToRawTransaction(params);
    const encodeTx = await this._convertRawTransactionToEncodeTx(
      rawTxn,
      hexBcsTxn,
      vault,
    );

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx, signOnly: true },
    )) as string;

    return Promise.resolve(hexToBytes(stripHexPrefix(result)).toString());
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: IEncodedTxAptos,
  ) {
    debugLogger.providerApi.info('aptos signTransaction', params);

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: params, signOnly: true },
    )) as string;

    return Promise.resolve(result);
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: SignMessagePayload,
  ): Promise<SignMessageResponse> {
    debugLogger.providerApi.info('aptos signMessage', params);

    // @ts-expect-error
    const isPetra = request.data?.aptosProviderType === 'petra';

    const account = await this.account(request);

    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const chainId = await (await vault.getClient()).getChainId();

    const format = formatSignMessageRequest(
      params,
      account?.address ?? '',
      request.origin ?? '',
      chainId,
    );

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        unsignedMessage: {
          type: AptosMessageTypes.SIGN_MESSAGE,
          message: JSON.stringify(format),
        },
      },
    )) as string;

    return Promise.resolve({
      ...format,
      prefix: APTOS_SIGN_MESSAGE_PREFIX,
      signature: isPetra ? stripHexPrefix(result) : result,
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
    debugLogger.providerApi.info('aptos signGenericTransaction', params);

    const encodeTx: IEncodedTxAptos = {
      type: 'entry_function_payload',
      function: params.func,
      arguments: params.args,
      type_arguments: params.type_args,
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    return Promise.resolve(result);
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
    debugLogger.providerApi.info('aptos createCollection', params);

    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_APTOS) {
      return undefined;
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;
    const address = await vault.getAccountAddress();

    const encodeTx = generateTransferCreateCollection(
      address,
      params.name,
      params.description,
      params.uri,
    );

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    return Promise.resolve(result);
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
    debugLogger.providerApi.info('aptos createToken', params);

    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_APTOS) {
      return undefined;
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;
    const address = await vault.getAccountAddress();

    const encodeTx = generateTransferCreateNft(
      address,
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

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    return Promise.resolve(result);
  }

  private async getAptosVault(): Promise<VaultAptos> {
    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_APTOS) {
      throw web3Errors.provider.chainDisconnected();
    }
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    return vault;
  }

  @providerApiMethod()
  public async getChainId() {
    debugLogger.providerApi.info('aptos getChainId');

    const vault = await this.getAptosVault();

    const chainId = await (await vault.getClient()).getChainId();
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
    debugLogger.providerApi.info('aptos generateTransaction');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    const rawTx = await client.generateTransaction(
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
    debugLogger.providerApi.info('aptos generateTransaction');

    const bcsTxn: Uint8Array = decodeBytesTransaction(params);
    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    const res = await client.submitTransaction(bcsTxn);
    return res.hash;
  }

  @providerApiMethod()
  public async getTransactions(
    request: IJsBridgeMessagePayload,
    params: { start?: string; limit?: number },
  ) {
    debugLogger.providerApi.info('aptos getTransactions');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    const { start } = params ?? {};
    return client.getTransactions({
      start: start ? BigInt(start) : undefined,
      limit: params.limit,
    });
  }

  @providerApiMethod()
  public async getTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ) {
    debugLogger.providerApi.info('aptos getTransaction');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    return client.getTransactionByHash(params);
  }

  @providerApiMethod()
  public async getAccountTransactions(
    request: IJsBridgeMessagePayload,
    params: {
      accountAddress: string;
      query?: { start?: string; limit?: number };
    },
  ) {
    debugLogger.providerApi.info('aptos getAccountTransactions');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    const { start } = params.query ?? {};
    return client.getAccountTransactions(params.accountAddress, {
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
    debugLogger.providerApi.info('aptos getAccountResources');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();

    const { ledgerVersion } = params.query ?? {};

    return client.getAccountResources(params.accountAddress, {
      ledgerVersion: ledgerVersion ? BigInt(ledgerVersion) : undefined,
    });
  }

  @providerApiMethod()
  public async getAccount(request: IJsBridgeMessagePayload, params: string) {
    debugLogger.providerApi.info('aptos getAccount');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    return client.getAccount(params);
  }

  @providerApiMethod()
  public async getLedgerInfo() {
    debugLogger.providerApi.info('aptos getLedgerInfo');

    const vault = await this.getAptosVault();
    const client = await vault.getClient();
    return client.getLedgerInfo();
  }
}

export default ProviderApiAptos;
