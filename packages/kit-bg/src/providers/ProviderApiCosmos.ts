/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

import { CommonMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { BroadcastMode } from '@onekeyhq/engine/src/vaults/impl/cosmos/NodeClient';
import type { StdSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/amino/types';
import { deserializeTx } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/txBuilder';
import { TransactionWrapper } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/wrapper';
import { getAminoSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/wrapper/utils';
import type VaultCosmos from '@onekeyhq/engine/src/vaults/impl/cosmos/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_COSMOS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { queue } from './HandleQueue';
import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiCosmos extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cosmos;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      let { networkId } = getActiveWalletAccount();
      if (networkId) {
        const [impl, chainId] = networkId.split('--');
        if (impl !== IMPL_COSMOS) {
          return;
        }
        networkId = chainId;
      }

      let params;
      try {
        params = await this._getKey({ origin }, networkId);
      } catch (error) {
        // ignore
      }
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = () => {
      const { networkId } = getActiveWalletAccount();
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_networkChange',
        params: networkId,
      };
      return result;
    };
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  private _enable = async (
    request: IJsBridgeMessagePayload,
    params: string[],
  ) => {
    const networkId = typeof params === 'string' ? params : params[0];

    const appNetworkId = this.convertCosmosChainId(networkId);
    if (!appNetworkId) throw new Error('Invalid chainId');

    let network;
    try {
      network = await this.backgroundApi.engine.getNetwork(appNetworkId);
    } catch (error) {
      network = undefined;
    }
    if (!network) return false;

    const key = await this._getKey(request, networkId);
    if (!key) return false;

    if (!this.hasPermissions(request, key.pubKey)) {
      await this.backgroundApi.serviceDapp.openConnectionModal(request, {
        networkId: IMPL_COSMOS,
      });
    }

    return true;
  };

  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload, params: string[]) {
    debugLogger.providerApi.info('cosmos enable', request, params);
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
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_COSMOS,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_COSMOS })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('cosmos disconnect', origin);
  }

  private convertCosmosChainId(networkId: string | undefined | null) {
    if (!networkId) return undefined;
    return `cosmos--${networkId.toLowerCase()}`;
  }

  private hasPermissions(request: IJsBridgeMessagePayload, pubKey: string) {
    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_COSMOS,
      });

    if (!connectedAccounts) {
      return false;
    }

    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(pubKey)) {
      return false;
    }

    return true;
  }

  private _getKey = async (
    request: IJsBridgeMessagePayload,
    params: string,
  ) => {
    const { networkImpl, accountId } = getActiveWalletAccount();

    const networkId = this.convertCosmosChainId(params);
    if (!networkId) throw new Error('Invalid chainId');

    if (networkImpl !== IMPL_COSMOS) {
      await this.backgroundApi.serviceDapp.openConnectionModal(request, {
        networkId: IMPL_COSMOS,
      });
      return Promise.reject(new Error('Invalid networkId'));
    }

    let network;
    try {
      network = await this.backgroundApi.engine.getNetwork(networkId);
    } catch (error) {
      network = undefined;
    }

    if (!network) return Promise.resolve(undefined);

    const vault = (await this.backgroundApi.engine.getVault({
      networkId: OnekeyNetwork.cosmoshub,
      accountId,
    })) as VaultCosmos;

    const account = await vault.getKey(networkId, accountId);

    return Promise.resolve(account);
  };

  @providerApiMethod()
  public async getKey(request: IJsBridgeMessagePayload, params: string) {
    debugLogger.providerApi.info('cosmos getKey account', request, params);
    return new Promise((resolve, reject) => {
      queue.enqueue(async () => {
        try {
          const result = await this._getKey(request, params);

          if (!result) {
            reject(new Error('No account found'));
          } else {
            if (!this.hasPermissions(request, result.pubKey)) {
              await this.backgroundApi.serviceDapp.openConnectionModal(
                request,
                {
                  networkId: IMPL_COSMOS,
                },
              );
            }

            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  @providerApiMethod()
  public async experimentalSuggestChain(
    request: IJsBridgeMessagePayload,
    params: any,
  ) {
    debugLogger.providerApi.info('cosmos experimentalSuggestChain', params);
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
    debugLogger.providerApi.info('cosmos signAmino', params);

    const encodeTx = params.signDoc;
    const networkId = this.convertCosmosChainId(encodeTx.chain_id);
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: TransactionWrapper.fromAminoSignDoc(encodeTx, undefined),
        signOnly: true,
        networkId,
      },
    )) as ISignedTxPro;

    const txInfo = deserializeTx(
      hexToBytes(Buffer.from(result.rawTx, 'base64').toString('hex')),
    );

    const tx = result.encodedTx as TransactionWrapper;
    const signDoc = getAminoSignDoc(tx);

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
    debugLogger.providerApi.info('cosmos signDirect', params);

    const networkId = this.convertCosmosChainId(params.signDoc.chainId);

    const encodeTx = params.signDoc;
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: TransactionWrapper.fromDirectSignDocHex(
          {
            bodyBytes: encodeTx.bodyBytes ?? '',
            authInfoBytes: encodeTx.authInfoBytes ?? '',
            chainId: encodeTx.chainId ?? '',
            accountNumber: encodeTx.accountNumber ?? '',
          },
          undefined,
        ),
        signOnly: true,
        networkId,
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
      mode: BroadcastMode;
    },
  ) {
    debugLogger.providerApi.info('cosmos sendTx', params);
    const { accountId } = getActiveWalletAccount();
    const networkId = this.convertCosmosChainId(params.chainId);
    if (!networkId) throw new Error('Invalid chainId');

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultCosmos;

    const res = await vault.broadcastTransaction({
      rawTx: Buffer.from(params.tx, 'hex').toString('base64'),
      txid: '',
      // @ts-expect-error
      encodedTx: null,
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
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        unsignedMessage: {
          type: CommonMessageTypes.SIGN_MESSAGE,
          message: JSON.stringify(paramsData),
          secure: true,
        },
        signOnly: true,
        networkId,
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
    debugLogger.providerApi.info('cosmos signArbitrary', params);

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
    debugLogger.providerApi.info('cosmos verifyArbitrary', params);
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
