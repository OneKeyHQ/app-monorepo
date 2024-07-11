/* eslint-disable @typescript-eslint/no-unused-vars */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { Semaphore } from 'async-mutex';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

import type { ICosmosStdSignDoc } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import {
  TransactionWrapper,
  deserializeTx,
  getAminoSignDoc,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiCosmos extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cosmos;

  private _queue = new Semaphore(1);

  private signMessageSemaphore = new Semaphore(1);

  private async _getAccount(
    request: IJsBridgeMessagePayload,
    networkId: string,
  ) {
    const accounts = await this.getAccountsInfo(request);

    let account = accounts.find(
      (item) => item.accountInfo?.networkId === networkId,
    );
    if (!account) {
      account = {
        account: await this.backgroundApi.serviceAccount.getAccount({
          networkId,
          accountId: accounts[0].account.id,
        }),
      };
    }

    return account;
  }

  private async _switchNetwork(
    request: IJsBridgeMessagePayload,
    networkId: string,
  ) {
    const accounts = await this.getAccountsInfo(request);
    const isSameNetwork = accounts.find(
      (item) => item.accountInfo?.networkId === networkId,
    );
    if (!isSameNetwork) {
      await this.backgroundApi.serviceDApp.switchConnectedNetwork({
        origin: request.origin ?? '',
        scope: request.scope ?? this.providerName,
        newNetworkId: networkId,
      });
    }
  }

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ) {
    const data = async () => {
      const accounts =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo({
          origin: info.targetOrigin,
          scope: this.providerName,
        });
      let params;
      try {
        if (accounts && accounts.length > 0) {
          params = this._getKeyFromAccount(accounts[0].account);
        }
      } catch {
        // ignore
      }
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ) {
    const data = async () => {
      const accounts =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo({
          origin: info.targetOrigin,
          scope: this.providerName,
        });
      let chainId;
      if (accounts && accounts.length > 0) {
        chainId = accounts[0].accountInfo?.networkId
          ? networkUtils.getNetworkChainId({
              networkId: accounts[0].accountInfo?.networkId,
            })
          : '';
      }
      const result = {
        method: 'wallet_events_networkChange',
        params: chainId,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
    this.notifyNetworkChangedToDappSite(info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  private async _enable(request: IJsBridgeMessagePayload, params: string[]) {
    const chainId = typeof params === 'string' ? params : params[0];

    const networkId = this.convertCosmosChainId(chainId);
    if (!networkId) throw new Error('Invalid chainId');

    const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
      networkId,
    });
    if (!network) return false;

    try {
      await this.getAccountsInfo(request);
    } catch (error) {
      try {
        await this.backgroundApi.serviceDApp.openConnectionModal(request);
        await timerUtils.wait(100);
        await this.getAccountsInfo(request);
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  @providerApiMethod()
  public enable(request: IJsBridgeMessagePayload, params: string[]) {
    return this._queue.runExclusive(() => this._enable(request, params));
  }

  @providerApiMethod()
  public async disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
  }

  private convertCosmosChainId(networkId: string | undefined | null) {
    if (!networkId) return undefined;
    return `cosmos--${networkId.toLowerCase()}`;
  }

  private _getKeyFromAccount(account: INetworkAccount) {
    return {
      name: account.name,
      algo: 'secp251k1',
      pubKey: account.pub,
      address: account.addressDetail.baseAddress,
      bech32Address: account.addressDetail.displayAddress,
      // eslint-disable-next-line spellcheck/spell-checker
      isNanoLedger: accountUtils.isHwAccount({
        accountId: account.id,
      }),
    };
  }

  @providerApiMethod()
  public async getKey(request: IJsBridgeMessagePayload, params: string) {
    const networkId = this.convertCosmosChainId(params);
    if (!networkId) throw new Error('Invalid chainId');
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) throw new Error('Invalid chainId');

    let account: {
      account: INetworkAccount;
      accountInfo?: Partial<IConnectionAccountInfo> | undefined;
    };
    try {
      account = await this._getAccount(request, networkId);
    } catch (error) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      await timerUtils.wait(100);
      account = await this._getAccount(request, networkId);
    }
    if (!account) {
      throw new Error('No account found');
    }

    return this._getKeyFromAccount(account.account);
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
      signDoc: ICosmosStdSignDoc;
      signOptions?: any;
    },
  ): Promise<any> {
    const txWrapper = TransactionWrapper.fromAminoSignDoc(
      params.signDoc,
      undefined,
    );

    const networkId = this.convertCosmosChainId(params.signDoc.chain_id);
    if (!networkId) throw new Error('Invalid chainId');

    const account = await this._getAccount(request, networkId);

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: txWrapper.toObject(),
        networkId,
        accountId: account?.account.id ?? '',
        signOnly: true,
      });

    const txInfo = deserializeTx(
      hexToBytes(Buffer.from(result.rawTx, 'base64').toString('hex')),
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
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: txWrapper.toObject(),
        networkId,
        accountId: account?.account.id ?? '',
        signOnly: true,
      });

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

    const res = await this.backgroundApi.serviceSend.broadcastTransaction({
      accountId: account.account.id ?? '',
      networkId,
      accountAddress: account?.account.address ?? '',
      signedTx: {
        rawTx: Buffer.from(params.tx, 'hex').toString('base64'),
        txid: '',
        encodedTx: null,
      },
    });

    return Promise.resolve(res);
  }

  private async signArbitraryMessage(
    request: IJsBridgeMessagePayload,
    params: {
      chainId: string;
      signer: string;
      data: string;
    },
  ) {
    return this.signMessageSemaphore.runExclusive(async () => {
      const paramsData = {
        data: params.data,
        signer: params.signer,
      };

      const networkId = this.convertCosmosChainId(params.chainId);
      if (!networkId) throw new Error('Invalid chainId');

      const account = await this._getAccount(request, networkId);

      await this._switchNetwork(request, networkId);

      const result = (await this.backgroundApi.serviceDApp.openSignMessageModal(
        {
          request,
          unsignedMessage: {
            type: EMessageTypesCommon.SIMPLE_SIGN,
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
    });
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
