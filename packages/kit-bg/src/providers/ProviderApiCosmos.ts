/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import { StdSignDoc, TransactionWrapper, baseAddressToAddress, deserializeTx, getAminoSignDoc } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import { ISignedTxPro } from '@onekeyhq/core/src/types';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';
import { queue } from './HandleQueue';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { vaultFactory } from '../vaults/factory';

@backgroundClass()
class ProviderApiCosmos extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cosmos;

  private async _getAccounts(request: IJsBridgeMessagePayload) {
    let accounts = await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(request);
    if (!accounts) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      await timerUtils.wait(100);
      accounts = await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(request);
    }
    if (!accounts) {
      throw web3Errors.provider.unauthorized();
    }
    return accounts;
  }

  private async _getAccount (
    request: IJsBridgeMessagePayload,
    networkId: string,
  ) {
    const accounts = await this._getAccounts(request);

    let account = accounts.find(item => item.accountInfo?.networkId === networkId);
    if (!account) {
      const vault = await vaultFactory.getVault({
        networkId,
        accountId: accounts[0].account.id,
      });
      const vaultAccount = await vault.getAccount();
      account = {
        account: vaultAccount,
        accountInfo: {
          ...accounts[0].accountInfo,
          address: vaultAccount.address,
          networkId,
        },
      };
    }
    
    return account;
  };

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const result = {
        method: 'wallet_events_accountChanged',
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = () => {
      const result = {
        method: 'wallet_events_networkChange',
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  private async _enable(request: IJsBridgeMessagePayload, params: string[]) {
    const chainId = typeof params === 'string' ? params : params[0];

    const networkId = this.convertCosmosChainId(chainId);
    if (!networkId) throw new Error('Invalid chainId');

    let network;
    try {
      network = await this.backgroundApi.serviceNetwork.getNetwork({ networkId });
    } catch (error) {
      network = undefined;
    }
    if (!network) return false;

    return true;
  }

  @providerApiMethod()
  public enable(request: IJsBridgeMessagePayload, params: string[]) {
    return new Promise((resolve, reject) => {
      queue.enqueue(async () => {
        try {
          const result = await this._enable(request, params);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'walletConnect',
    });
  }

  private convertCosmosChainId(networkId: string | undefined | null) {
    if (!networkId) return undefined;
    return `cosmos--${networkId.toLowerCase()}`;
  }

  @providerApiMethod()
  public async getKey(request: IJsBridgeMessagePayload, params: string) {
    const networkId = this.convertCosmosChainId(params);
    if (!networkId) throw new Error('Invalid chainId');
    const network = await this.backgroundApi.serviceNetwork.getNetwork({ networkId });
    if (!network) throw new Error('Invalid chainId');

    const account = await this._getAccount(request, networkId);
    if (!account) {
      throw new Error('No account found');
    }

    return {
      name: account.account.name,
      algo: 'secp251k1',
      pubKey: account.account.pub,
      address: account.account.addressDetail.baseAddress,
      bech32Address: account.account.addressDetail.displayAddress,
    }
  }

  @providerApiMethod()
  public async experimentalSuggestChain(
    request: IJsBridgeMessagePayload,
    params: any,
  ) {
    return Promise.resolve(new Error('Not implemented'));
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAmino(
    request: IJsBridgeMessagePayload,
    params: {
      signer: string;
      signDoc: StdSignDoc;
      signOptions?: any;
    },
  ): Promise<any> {
    const txWrapper = TransactionWrapper.fromAminoSignDoc(params.signDoc, undefined);

    const networkId = this.convertCosmosChainId(params.signDoc.chain_id);
    if (!networkId) throw new Error('Invalid chainId');

    const account = await this._getAccount(request, networkId);

    const result = (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
      request,
      encodedTx: txWrapper.toObject(),
      networkId,
      accountId: account?.account.id ?? '',
      signOnly: true,
    })) as string;

    const txInfo = deserializeTx(
      hexToBytes(Buffer.from(result, 'base64').toString('hex')),
    );

    const signDoc = getAminoSignDoc(txWrapper);
    if (txInfo.authInfo.fee) {
      signDoc.fee.amount = txInfo.authInfo.fee.amount;
      signDoc.fee.gas = txInfo.authInfo.fee.gasLimit.toString();
    }

    const [signerInfo] = txInfo.authInfo.signerInfos;
    const [signature] = txInfo.signatures;

    const pubKey = PubKey.decode(
      signerInfo?.publicKey?.value ?? new Uint8Array(),
    );

    return {
      signed: signDoc,
      signature: {
        signature: Buffer.from(bytesToHex(signature), 'hex').toString('base64'),
        pub_key: {
          type: signerInfo?.publicKey?.typeUrl,
          value: Buffer.from(pubKey.key).toString('base64'),
        },
      },
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async signDirect(
    request: IJsBridgeMessagePayload,
    params: {
      signer: string;
      signDoc: {
        /** SignDoc bodyBytes */
        bodyBytes?: string | null;

        /** SignDoc authInfoBytes */
        authInfoBytes?: string | null;

        /** SignDoc chainId */
        chainId?: string | null;

        /** SignDoc accountNumber */
        accountNumber?: string | null;
      };
      signOptions?: any;
    },
  ): Promise<any> {
    const networkId = this.convertCosmosChainId(params.signDoc.chainId);
    if (!networkId) throw new Error('Invalid chainId');

    const account = await this._getAccount(request, networkId);

    const encodeTx = params.signDoc;
    const txWrapper = TransactionWrapper.fromDirectSignDocHex(
      {
        bodyBytes: encodeTx.bodyBytes ?? '',
        authInfoBytes: encodeTx.authInfoBytes ?? '',
        chainId: encodeTx.chainId ?? '',
        accountNumber: encodeTx.accountNumber ?? '',
      },
      undefined,
    );
    const result = (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal(
      {
        request,
        encodedTx: txWrapper.toObject(),
        networkId,
        accountId: account?.account.id ?? '',
        signOnly: true,
      },
    )) as ISignedTxPro;

    const txInfo = deserializeTx(
      hexToBytes(Buffer.from(result.rawTx, 'base64').toString('hex')),
    );

    const [signerInfo] = txInfo.authInfo.signerInfos;
    const [signature] = txInfo.signatures;

    const pubKey = PubKey.decode(
      signerInfo?.publicKey?.value ?? new Uint8Array(),
    );

    return {
      signed: {
        bodyBytes: bytesToHex(
          TxBody.encode(
            TxBody.fromPartial({
              ...txInfo.txBody,
            }),
          ).finish(),
        ),
        authInfoBytes: bytesToHex(
          AuthInfo.encode(
            AuthInfo.fromPartial({
              ...txInfo.authInfo,
            }),
          ).finish(),
        ),
        chainId: params.signDoc.chainId,
        accountNumber: params.signDoc.accountNumber,
      },
      signature: {
        signature: Buffer.from(bytesToHex(signature), 'hex').toString('base64'),
        pub_key: {
          type: signerInfo?.publicKey?.typeUrl,
          value: Buffer.from(pubKey.key).toString('base64'),
        },
      },
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async sendTx(
    request: IJsBridgeMessagePayload,
    params: {
      chainId: string;
      tx: string;
      mode: string;
    },
  ) {
    const networkId = this.convertCosmosChainId(params.chainId);
    if (!networkId) throw new Error('Invalid chainId');

    const account = await this._getAccount(request, networkId);

    const res = await this.backgroundApi.serviceSend.broadcastTransactionLegacy({
      networkId,
      accountId: account?.account.id ?? '',
      accountAddress: account?.account.address ?? '',
      signedTx: {
        rawTx: Buffer.from(params.tx, 'hex').toString('base64'),
        txid: '',
        encodedTx: null,
      },
    });

    return Promise.resolve(res.txid);
  }

  private async signArbitraryMessage(
    request: IJsBridgeMessagePayload,
    params: {
      chainId: string;
      signer: string;
      data: string;
    },
  ) {
    const paramsData = {
      data: params.data,
      signer: params.signer,
    };

    const networkId = this.convertCosmosChainId(params.chainId);
    if (!networkId) throw new Error('Invalid chainId');
    
    const account = await this._getAccount(request, networkId);
  
    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        unsignedMessage: {
          type: EMessageTypesCommon.SIGN_MESSAGE,
          message: JSON.stringify(paramsData),
          secure: true,
        },
        networkId,
        accountId: account?.account.id ?? '',
      },
    )) as string;

    return deserializeTx(
      hexToBytes(Buffer.from(result, 'base64').toString('hex')),
    );
  }

  @permissionRequired()
  @providerApiMethod()
  public async signArbitrary(
    request: IJsBridgeMessagePayload,
    params: {
      chainId: string;
      signer: string;
      data: string;
    },
  ): Promise<any> {
    const txInfo = await this.signArbitraryMessage(request, params);

    const [signerInfo] = txInfo.authInfo.signerInfos;
    const [signature] = txInfo.signatures;

    const pubKey = PubKey.decode(
      signerInfo?.publicKey?.value ?? new Uint8Array(),
    );

    return {
      signature: Buffer.from(bytesToHex(signature), 'hex').toString('base64'),
      pub_key: {
        type: signerInfo?.publicKey?.typeUrl,
        value: Buffer.from(pubKey.key).toString('base64'),
      },
    };
  }

  @permissionRequired()
  @providerApiMethod()
  public async verifyArbitrary(
    request: IJsBridgeMessagePayload,
    params: {
      chainId: string;
      signer: string;
      data: string;
      signature: {
        signature: string;
        pub_key: {
          type: string;
          value: string;
        };
      };
    },
  ): Promise<any> {
    const txInfo = await this.signArbitraryMessage(request, params);

    const [signerInfo] = txInfo.authInfo.signerInfos;
    const [signature] = txInfo.signatures;

    const pubKey = PubKey.decode(
      signerInfo?.publicKey?.value ?? new Uint8Array(),
    );

    const signatureInfo = {
      signature: Buffer.from(bytesToHex(signature), 'hex').toString('base64'),
      pub_key: {
        type: signerInfo?.publicKey?.typeUrl,
        value: Buffer.from(pubKey.key).toString('base64'),
      },
    };

    if (
      signatureInfo.signature === params.signature.signature &&
      signatureInfo.pub_key.value === params.signature.pub_key.value
    ) {
      return true;
    }
    return false;
  }
}

export default ProviderApiCosmos;
