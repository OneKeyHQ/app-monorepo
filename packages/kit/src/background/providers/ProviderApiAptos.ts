/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import { BCS, TxnBuilderTypes, bytesToHex } from 'aptos';

import { IMPL_APTOS } from '@onekeyhq/engine/src/constants';
import { IEncodedTxAptos } from '@onekeyhq/engine/src/vaults/impl/apt/types';
import {
  generateTransferCreateCollection,
  generateTransferCreateNft,
  transactionPayloadToTxPayload,
} from '@onekeyhq/engine/src/vaults/impl/apt/utils';
import VaultAptos from '@onekeyhq/engine/src/vaults/impl/apt/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { hexlify } from '../../../../engine/src/vaults/utils/hexUtils';
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
    const account = await this.account();
    if (!account) return null;
    return this.backgroundApi.serviceDapp
      .openConnectionModal(request)
      .then(() => account);
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

    console.log('===== signAndSubmitTransaction result', result);

    const tx = await vault.getTransactionByHash(result);

    return Promise.resolve(JSON.stringify(tx));
  }

  @permissionRequired()
  @providerApiMethod()
  public async martianSignAndSubmitTransaction(
    request: IJsBridgeMessagePayload,
    params: string,
  ): Promise<string> {
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultAptos;

    const bcsTxn = new Uint8Array(
      params.split(',').map((item) => parseInt(item, 10)),
    );

    const hexBcsTxn = bytesToHex(bcsTxn);

    const deserializer = new BCS.Deserializer(bcsTxn);
    const rawTxn = TxnBuilderTypes.RawTransaction.deserialize(deserializer);

    const payload = await transactionPayloadToTxPayload(
      await vault.getClient(),
      // @ts-expect-error
      rawTxn.payload.value,
    );

    const encodeTx = {
      sender: hexlify(rawTxn?.sender?.address),
      sequence_number: rawTxn?.sequence_number,
      max_gas_amount: rawTxn?.max_gas_amount,
      gas_unit_price: rawTxn?.gas_unit_price,
      expiration_timestamp_secs: rawTxn?.expiration_timestamp_secs,
      chain_id: rawTxn?.chain_id,

      bscTxn: hexBcsTxn,

      ...payload,
      // todo: codes
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    return Promise.resolve(result);
  }

  @permissionRequired()
  @providerApiMethod()
  public martianSignTransaction() {
    throw web3Errors.rpc.methodNotFound();
  }

  @permissionRequired()
  @providerApiMethod()
  public signTransaction() {
    throw web3Errors.rpc.methodNotFound();
  }

  @permissionRequired()
  @providerApiMethod()
  public signMessage() {
    throw web3Errors.rpc.methodNotFound();
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
