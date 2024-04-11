/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import {
  getOnChainHistoryTxAssetInfo,
  getOnChainHistoryTxStatus,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxApprove,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBWalletType,
} from '../../dbs/local/types';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildHistoryTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ISignTransactionParams,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = IDBWalletType;

if (platformEnv.isExtensionUi) {
  debugger;
  throw new Error('engine/VaultBase is not allowed imported from ui');
}

export abstract class VaultBaseChainOnly extends VaultContext {
  coreApi: CoreChainApiBase | undefined;

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  // **** address parser: dbAddress, baseAddress, displayAddress, utxoAddress, normalizedAddress
  // async addressFromBase(account: DBAccount): Promise<string> {
  // async addressToBase(address: string): Promise<string> {
  // async getDisplayAddress(address: string): Promise<string> {

  abstract validateAddress(address: string): Promise<IAddressValidation>;

  abstract validateXpub(xpub: string): Promise<IXpubValidation>;

  abstract validateXprvt(xprvt: string): Promise<IXprvtValidation>;

  abstract validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation>;

  abstract validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation>;

  async baseValidatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    if (!this.coreApi) {
      throw new Error('coreApi not defined in Vault');
    }
    try {
      const networkInfo = await this.getCoreApiNetworkInfo();
      const result = await this.coreApi.getAddressFromPrivate({
        networkInfo,
        privateKeyRaw: privateKey,
      });
      if (result.publicKey) {
        return {
          isValid: true,
        };
      }
    } catch (error) {
      console.error(error);
    }
    return {
      isValid: false,
    };
  }

  async baseValidateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<{ result: IGeneralInputValidation; inputDecoded: string }> {
    const input = decodeSensitiveText({
      encodedText: params.input,
    });
    const { validateAddress, validateXprvt, validateXpub, validatePrivateKey } =
      params;

    const result: IGeneralInputValidation = { isValid: false };

    let isValid = false;

    let addressResult: IAddressValidation | undefined;
    let xpubResult: IXpubValidation | undefined;
    let xprvtResult: IXprvtValidation | undefined;
    let privateKeyResult: IPrivateKeyValidation | undefined;

    if (validateAddress && !isValid) {
      try {
        addressResult = await this.validateAddress(input);
        result.addressResult = addressResult;
        isValid = isValid || addressResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validateXpub && !isValid) {
      try {
        xpubResult = await this.validateXpub(input);
        result.xpubResult = xpubResult;
        isValid = isValid || xpubResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validateXprvt && !isValid) {
      try {
        xprvtResult = await this.validateXprvt(input);
        result.xprvtResult = xprvtResult;
        isValid = isValid || xprvtResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    if (validatePrivateKey && !isValid) {
      try {
        privateKeyResult = await this.validatePrivateKey(input);
        result.privateKeyResult = privateKeyResult;
        isValid = isValid || privateKeyResult?.isValid;
      } catch (error) {
        console.error(error);
      }
    }

    result.isValid = Boolean(isValid);

    return { result, inputDecoded: input };
  }

  async baseGetPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = hexUtils.stripHexPrefix(input);
    privateKey = encodeSensitiveText({ text: privateKey });
    return {
      privateKey,
    };
  }

  abstract getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult>;
}

// **** more VaultBase: VaultBaseEvmLike, VaultBaseUtxo, VaultBaseVariant
// **** or more interface to implement: IVaultEvmLike, IVaultUtxo, IVaultVariant
export abstract class VaultBase extends VaultBaseChainOnly {
  uuid: string = generateUUID();

  keyring!: KeyringBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBase>;

  async init(config: IVaultInitConfig) {
    await this.initKeyring(config);
  }

  async initKeyring(config: IVaultInitConfig) {
    if (!this.options.isChainOnly) {
      this.keyring = await config.keyringCreator(this);
    }
  }

  abstract buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail>;

  abstract buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx>;

  abstract buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx>;

  abstract buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro>;

  async validateSendAmount() {
    return Promise.resolve(true);
  }

  async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTx | undefined;
  }) {
    return Promise.resolve(encodedTx);
  }

  async buildHistoryTx({
    historyTxToMerge,
    decodedTx,
    signedTx,
    isSigner,
    isLocalCreated,
  }: {
    historyTxToMerge?: IAccountHistoryTx;
    decodedTx: IDecodedTx;
    signedTx?: ISignedTxPro;
    isSigner?: boolean;
    isLocalCreated?: boolean;
  }): Promise<IAccountHistoryTx> {
    const txid: string = signedTx?.txid || decodedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }
    const address = await this.getAccountAddress();
    decodedTx.txid = txid || decodedTx.txid;
    decodedTx.owner = address;
    if (isSigner) {
      decodedTx.signer = address;
    }

    // must include accountId here, so that two account wont share same tx history
    const historyId = accountUtils.buildLocalHistoryId({
      networkId: this.networkId,
      txid,
      accountId: this.accountId,
    });
    const historyTx: IAccountHistoryTx = {
      id: historyId,

      isLocalCreated: Boolean(isLocalCreated),

      ...historyTxToMerge,

      decodedTx,
    };
    return Promise.resolve(historyTx);
  }

  async buildOnChainHistoryTx(
    params: IBuildHistoryTxParams,
  ): Promise<IAccountHistoryTx | null> {
    const { accountId, networkId, onChainHistoryTx, tokens, nfts } = params;
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    try {
      const action = await this.buildHistoryTxAction({
        tx: onChainHistoryTx,
        tokens,
        nfts,
      });

      const decodedTx: IDecodedTx = {
        txid: onChainHistoryTx.tx,

        owner: onChainHistoryTx.from,
        signer: onChainHistoryTx.from,

        nonce: onChainHistoryTx.nonce,
        actions: [action],

        status: getOnChainHistoryTxStatus(onChainHistoryTx.status),

        networkId,
        accountId,

        totalFeeInNative: onChainHistoryTx.gasFee,

        totalFeeFiatValue: onChainHistoryTx.gasFeeFiatValue,

        nativeAmount: vaultSettings.isUtxo ? onChainHistoryTx.value : undefined,

        extraInfo: null,
        payload: {
          type: onChainHistoryTx.type,
        },
      };

      decodedTx.updatedAt = new Date(
        onChainHistoryTx.timestamp * 1000,
      ).getTime();
      decodedTx.createdAt = decodedTx.updatedAt;
      // On chain tx is always final
      decodedTx.isFinal = true;

      return await this.buildHistoryTx({
        decodedTx,
      });
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  async buildHistoryTxAction({
    tx,
    tokens,
    nfts,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }) {
    if (tx.type === EOnChainHistoryTxType.Approve && tx.tokenApprove) {
      return this.buildHistoryTxApproveAction({
        tx,
        tokens,
        nfts,
        tokenApprove: tx.tokenApprove,
      });
    }

    if (isEmpty(tx.sends) && isEmpty(tx.receives)) {
      if (tx.type) return this.buildHistoryTxFunctionCallAction({ tx });
      return this.buildHistoryTxUnknownAction({ tx });
    }

    return this.buildHistoryTransferAction({ tx, tokens, nfts });
  }

  async buildHistoryTxFunctionCallAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        from: tx.from,
        to: tx.to,
        functionName: tx.type,
        functionHash: tx.functionCode,
        args: tx.params,
        icon: network.logoURI,
      },
    };
  }

  async buildHistoryTxUnknownAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: tx.from,
        to: tx.to,
        icon: network.logoURI,
      },
    };
  }

  buildHistoryTransferAction({
    tx,
    tokens,
    nfts,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }): IDecodedTxAction {
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: tx.from,
        to: tx.to,
        label: tx.label,
        sends: tx.sends.map((send) =>
          this.buildHistoryTransfer({
            transfer: send,
            tokens,
            nfts,
          }),
        ),
        receives: tx.receives.map((receive) =>
          this.buildHistoryTransfer({
            transfer: receive,
            tokens,
            nfts,
          }),
        ),
      },
    };
  }

  buildHistoryTransfer({
    transfer,
    tokens,
    nfts,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
  }) {
    const { icon, symbol, name, isNFT, isNative, price } =
      getOnChainHistoryTxAssetInfo({
        tokenAddress: transfer.token,
        tokens,
        nfts,
      });

    return {
      from: transfer.from,
      to: transfer.to,
      tokenIdOnNetwork: transfer.token,
      amount: transfer.amount,
      label: transfer.label,
      isOwn: transfer.isOwn,
      icon,
      name,
      symbol,
      isNFT,
      isNative,
      price,
    };
  }

  buildHistoryTxApproveAction({
    tx,
    tokens,
    nfts,
    tokenApprove,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IOnChainHistoryTxNFT>;
    tokenApprove: IOnChainHistoryTxApprove;
  }): IDecodedTxAction {
    const { icon, symbol, name, decimals } = getOnChainHistoryTxAssetInfo({
      tokenAddress: tokenApprove.token,
      tokens,
      nfts,
    });
    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: tx.from,
        to: tokenApprove.spender,
        icon,
        name,
        symbol,
        tokenIdOnNetwork: tokenApprove.token,
        amount: new BigNumber(tokenApprove.amount)
          .shiftedBy(-decimals)
          .toFixed(),
        isInfiniteAmount: tokenApprove.isInfiniteAmount,
      },
    };
  }

  // DO NOT override this method
  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    params.signOnly = params.signOnly ?? true;
    const signedTx = await this.keyring.signTransaction(params);
    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx ?? unsignedTx.encodedTx,
    };
  }

  // TODO resetCache after dbAccount and network DB updated
  // TODO add memo
  async getAccount(): Promise<INetworkAccount> {
    const account: IDBAccount =
      await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: this.accountId,
      });

    if (
      !accountUtils.isAccountCompatibleWithNetwork({
        account,
        networkId: this.networkId,
      })
    ) {
      throw new Error(
        `account impl not matched to network: ${this.networkId} ${account.id}`,
      );
    }

    const networkInfo = await this.getNetworkInfo();

    const externalAccount = account as IDBExternalAccount;
    let externalAccountAddress = '';
    if (externalAccount.connectedAddresses) {
      const buildExternalAccountAddress = ({
        key,
        fallbackIndex,
      }: {
        key: string;
        fallbackIndex: number;
      }) => {
        if (!key) {
          return '';
        }
        const index = externalAccount.selectedAddress?.[key] ?? fallbackIndex;
        const addresses =
          externalAccount.connectedAddresses?.[key]
            ?.split(',')
            .filter(Boolean) || [];
        return addresses?.[index] || addresses?.[fallbackIndex] || '';
      };

      externalAccountAddress = buildExternalAccountAddress({
        key: this.networkId,
        fallbackIndex: -1,
      });
      if (!externalAccountAddress) {
        const impl = await this.getNetworkImpl();
        externalAccountAddress = buildExternalAccountAddress({
          key: impl,
          fallbackIndex: 0,
        });
      }
      if (!externalAccountAddress) {
        externalAccountAddress = buildExternalAccountAddress({
          key: this.networkId,
          fallbackIndex: 0,
        });
      }
    }

    const addressDetail = await this.buildAccountAddressDetail({
      networkInfo,
      account,
      networkId: this.networkId,
      externalAccountAddress,
    });

    // always use addressDetail.address as account.address, which is normalized and validated
    const address = addressDetail?.address || '';

    if (
      (!address && !addressDetail.allowEmptyAddress) ||
      !addressDetail.isValid
    ) {
      throw new Error('VaultBase.getAccount ERROR: address is invalid');
    }
    return {
      ...account,
      addressDetail,
      address,
    };
  }

  async getAccountAddress() {
    return (await this.getAccount()).address;
  }

  async getAccountPath() {
    return (await this.getAccount()).path;
  }

  async getAccountXpub(): Promise<string | undefined> {
    return undefined;
  }
}
