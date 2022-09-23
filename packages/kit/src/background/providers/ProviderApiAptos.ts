/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import { BCS, TxnBuilderTypes, Types } from 'aptos';

import { IMPL_APTOS } from '@onekeyhq/engine/src/constants';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import {
  IEncodedTxAptos,
  SignMessagePayload,
  SignMessageResponse,
} from '@onekeyhq/engine/src/vaults/impl/apt/types';
import {
  formatSignMessage,
  generateTransferCreateCollection,
  generateTransferCreateNft,
  transactionPayloadToTxPayload,
} from '@onekeyhq/engine/src/vaults/impl/apt/utils';
import VaultAptos from '@onekeyhq/engine/src/vaults/impl/apt/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  hexlify,
  stripHexPrefix,
} from '../../../../engine/src/vaults/utils/hexUtils';
import { getActiveWalletAccount } from '../../hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

@backgroundClass()
class ProviderApiAptos extends ProviderApiBase {
  public providerName = IInjectedProviderNames.aptos;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.account();
      const result = {
        method: 'wallet_events_accountsChanged',
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

  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info('aptos connect', request);
    const account = await this.account();
    if (!account) return null;
    return this.backgroundApi.serviceDapp
      .openConnectionModal(request)
      .then(() => ({
        ...account,
        'method': 'connected',
        'status': 200,
      }));
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
  public async account(): Promise<
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
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;
    const address = await vault.getAccountAddress();
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
    const bcsTxn = new Uint8Array(
      txn.split(',').map((item) => parseInt(item, 10)),
    );

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
      sequence_number: transaction?.sequence_number,
      max_gas_amount: transaction?.max_gas_amount,
      gas_unit_price: transaction?.gas_unit_price,
      expiration_timestamp_secs: transaction?.expiration_timestamp_secs,
      chain_id: transaction?.chain_id,

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

    const txSignature = new TxnBuilderTypes.Ed25519Signature(
      hexToBytes(result),
    );

    const publicKey = await vault._getPublicKey();

    const authenticator = new TxnBuilderTypes.TransactionAuthenticatorEd25519(
      new TxnBuilderTypes.Ed25519PublicKey(
        hexToBytes(stripHexPrefix(publicKey)),
      ),
      txSignature,
    );

    const signedTn = new TxnBuilderTypes.SignedTransaction(
      rawTxn,
      authenticator,
    );

    const serialize = new BCS.Serializer();
    signedTn.serialize(serialize);

    return Promise.resolve(serialize.getBytes().toString());
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransaction(
    request: IJsBridgeMessagePayload,
    params: Types.TransactionPayload,
  ) {
    debugLogger.providerApi.info('aptos signTransaction', params);
    const encodeTx = params;

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx, signOnly: true },
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
    const account = await this.account();

    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const chainId = await (await vault.getClient()).getChainId();

    const format = formatSignMessage(
      params,
      account?.address ?? '',
      request.origin ?? '',
      chainId,
    );

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        unsignedMessage: {
          // Use PERSONAL_SIGN to sign plain message
          type: ETHMessageTypes.PERSONAL_SIGN,
          message: format.fullMessage,
        },
      },
    )) as string;

    format.signature = result;

    return Promise.resolve(format);
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

    const encodeTx = {
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
}

export default ProviderApiAptos;
