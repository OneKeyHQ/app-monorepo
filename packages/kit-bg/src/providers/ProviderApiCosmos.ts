/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { AuthInfo, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';

import type { BroadcastMode } from '@onekeyhq/engine/src/vaults/impl/cosmos/NodeClient';
import type { StdSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/amino/types';
import { deserializeTx } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/txBuilder';
import { TransactionWrapper } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/wrapper';
import { getAminoSignDoc } from '@onekeyhq/engine/src/vaults/impl/cosmos/sdk/wrapper/utils';
import {
  getADR36SignDoc,
  getDataForADR36,
} from '@onekeyhq/engine/src/vaults/impl/cosmos/utils';
import type VaultCosmos from '@onekeyhq/engine/src/vaults/impl/cosmos/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_COSMOS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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

      const params = await this.getKey({ origin }, networkId);
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

  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload, params: string[]) {
    debugLogger.providerApi.info('cosmos enable', request, params);
    const networkId = typeof params === 'string' ? params : params[0];
    const { accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId: this.convertCosmosChainId(networkId),
      accountId,
    })) as VaultCosmos;

    const address = await vault.getAccountAddress();
    if (!this.hasPermissions(request, address)) {
      await this.backgroundApi.serviceDapp.openConnectionModal(request);
    }

    await this.getKey(request, networkId);

    return true;
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
    debugLogger.providerApi.info('aptos disconnect', origin);
  }

  private convertCosmosChainId(networkId: string) {
    return `cosmos--${networkId.toLowerCase()}`;
  }

  private hasPermissions(request: IJsBridgeMessagePayload, address: string) {
    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_COSMOS,
      });
    if (!connectedAccounts) {
      return false;
    }

    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(address)) {
      return false;
    }

    return true;
  }

  @providerApiMethod()
  public async getKey(request: IJsBridgeMessagePayload, params: string) {
    debugLogger.providerApi.info('cosmos account', params);
    const { networkImpl, accountId } = getActiveWalletAccount();

    const networkId = this.convertCosmosChainId(params);
    if (networkImpl !== IMPL_COSMOS) {
      return undefined;
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultCosmos;

    const account = await vault.getKey(networkId, accountId);
    console.log('account', account);
    return Promise.resolve(account);
  }

  @providerApiMethod()
  public async experimentalSuggestChain(
    request: IJsBridgeMessagePayload,
    params: any,
  ) {
    debugLogger.providerApi.info('cosmos experimentalSuggestChain', params);
    return Promise.resolve();
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
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: TransactionWrapper.fromAminoSignDoc(encodeTx, undefined),
        signOnly: true,
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
    debugLogger.providerApi.info('cosmos signAmino', params);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [data, isADR36WithString] = getDataForADR36(params.data);
    const unsignDoc = getADR36SignDoc(params.signer, data);

    const encodeTx = unsignDoc;
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: TransactionWrapper.fromAminoSignDoc(encodeTx, undefined),
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
    debugLogger.providerApi.info('cosmos signAmino', params);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [data, isADR36WithString] = getDataForADR36(params.data);
    const unsignDoc = getADR36SignDoc(params.signer, data);

    const encodeTx = unsignDoc;
    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: TransactionWrapper.fromAminoSignDoc(encodeTx, undefined),
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
