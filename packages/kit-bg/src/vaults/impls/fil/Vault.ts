/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CoinType,
  decode,
  delegatedFromEthAddress,
  encode,
  newSecp256k1Address,
  validateAddressString,
} from '@glif/filecoin-address';
import { Message } from '@glif/filecoin-message';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { isEmpty, isNil, isObject } from 'lodash';

import type { IEncodedTxFil } from '@onekeyhq/core/src/chains/fil/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveText,
  encodeSensitiveText,
  uncompressPublicKey,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IResolveNameResp } from '@onekeyhq/shared/types/name';
import {
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { EProtocolIndicator, ETransferMethod } from './types';

import type {
  IDBAccount,
  IDBVariantAccount,
  IDBWalletType,
} from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.fil.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { networkId } = params;
    const account = params.account as IDBVariantAccount;
    const networkInfo = await this.getNetworkInfo();
    const network = await this.getNetwork();

    let address = account.addresses[networkId];

    if (account.pub) {
      const pubUncompressed = uncompressPublicKey(
        networkInfo.curve,
        bufferUtils.toBuffer(account.pub),
      );
      const coinType = network.isTestnet ? CoinType.TEST : CoinType.MAIN;
      address = newSecp256k1Address(pubUncompressed, coinType).toString();
    }

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxFil> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: { transferInfo: ITransferInfo }) {
    const { transferInfo } = params;
    const { tokenInfo } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const { from, to, amount } = transferInfo;
    const network = await this.getNetwork();
    let filToAddress = to;

    if (ethers.utils.isAddress(filToAddress)) {
      filToAddress = delegatedFromEthAddress(
        to,
        network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      );
    }

    const method =
      Number(filToAddress[1]) === EProtocolIndicator.DELEGATED
        ? ETransferMethod.EVM
        : ETransferMethod.FIL;

    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }

    const message = new Message({
      from,
      to: filToAddress,
      nonce: 0,
      value: amountBN.shiftedBy(network.decimals),
      method,
      params: '',
    });
    return message.toLotusType();
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountAddress,
    });

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.From,
      to: encodedTx.To,
      tokenIdOnNetwork: nativeToken.address,
      icon: nativeToken.logoURI ?? '',
      name: nativeToken.name,
      symbol: nativeToken.symbol,
      amount: new BigNumber(encodedTx.Value)
        .shiftedBy(-nativeToken.decimals)
        .toFixed(),
      isNFT: false,
      isNative: true,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.From,
      to: encodedTx.To,
      transfers: [transfer],
    });

    const decodedTx: IDecodedTx = {
      txid:
        (isObject(encodedTx.CID) ? encodedTx.CID['/'] : encodedTx.CID) || '',
      owner: accountAddress,
      signer: encodedTx.From || accountAddress,
      nonce: encodedTx.Nonce || 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      extraInfo: null,
    };

    return decodedTx;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxFil);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxFil,
  ): Promise<IUnsignedTxPro> {
    const tx = {
      ...encodedTx,
    };

    return Promise.resolve({
      encodedTx: tx,
      nonce: isNil(tx.Nonce) ? tx.Nonce : new BigNumber(tx.Nonce).toNumber(),
    });
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo, nonceInfo, nativeAmountInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxFil;

    if (feeInfo) {
      encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: encodedTxNew,
        feeInfo,
      });
    }

    if (nonceInfo) {
      encodedTxNew = await this._attachNonceInfoToEncodedTx({
        encodedTx: encodedTxNew,
        nonceInfo,
      });
      unsignedTx.nonce = nonceInfo.nonce;
    }

    if (nativeAmountInfo) {
      encodedTxNew = await this._updateNativeTokenAmount({
        encodedTx: encodedTxNew,
        nativeAmountInfo,
      });
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxFil;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxFil> {
    const { encodedTx, feeInfo } = params;
    const { feeDecimals } = feeInfo.common;

    const encodedTxWithFee = { ...encodedTx };

    if (feeInfo.gasFil) {
      encodedTxWithFee.GasLimit = new BigNumber(
        feeInfo.gasFil.gasLimit ?? 0,
      ).toNumber();
      encodedTxWithFee.GasFeeCap = new BigNumber(feeInfo.gasFil.gasFeeCap ?? 0)
        .shiftedBy(feeDecimals)
        .toFixed();
      encodedTxWithFee.GasPremium = new BigNumber(
        feeInfo.gasFil.gasPremium ?? 0,
      )
        .shiftedBy(feeDecimals)
        .toFixed();
    }
    return Promise.resolve(encodedTxWithFee);
  }

  async _attachNonceInfoToEncodedTx(params: {
    encodedTx: IEncodedTxFil;
    nonceInfo: { nonce: number };
  }): Promise<IEncodedTxFil> {
    const { encodedTx, nonceInfo } = params;
    const tx = {
      ...encodedTx,
      Nonce: nonceInfo.nonce,
    };

    return Promise.resolve(tx);
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxFil;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;
    const network = await this.getNetwork();

    let newValue = encodedTx.Value;

    if (!isNil(nativeAmountInfo.maxSendAmount)) {
      newValue = chainValueUtils.convertAmountToChainValue({
        value: nativeAmountInfo.maxSendAmount,
        network,
      });
    }

    const tx = {
      ...encodedTx,
      Value: newValue,
    };
    return Promise.resolve(tx);
  }

  async _getOutputAddress(address: string) {
    const network = await this.getNetwork();
    const addressObj = decode(address);

    return encode(
      network.isTestnet ? CoinType.TEST : CoinType.MAIN,
      addressObj,
    );
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValidFilAddress = validateAddressString(address);

    if (isValidFilAddress) {
      const outputAddress = await this._getOutputAddress(address);
      return Promise.resolve({
        isValid: true,
        normalizedAddress: outputAddress,
        displayAddress: outputAddress,
      });
    }

    return {
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    };
  }

  override async addressFromBase(account: IDBAccount): Promise<string> {
    const { isTestnet } = await this.getNetwork();
    return encode(
      isTestnet ? CoinType.TEST : CoinType.MAIN,
      decode(account.address),
    );
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const credential = decodeSensitiveText({ encodedText: params.input });

    let privateKey;
    if (credential.length === 160) {
      // Lotus type private key:
      try {
        const result = JSON.parse(
          Buffer.from(credential, 'hex').toString(),
        ) as { Type: string; PrivateKey: string };
        if (result.PrivateKey) {
          privateKey = Buffer.from(result.PrivateKey, 'base64');
        }
      } catch {
        // pass
      }
    } else if (credential.length === 64) {
      privateKey = Buffer.from(credential, 'hex');
    }

    privateKey = encodeSensitiveText({
      text: privateKey?.toString('hex') ?? '',
    });

    return Promise.resolve({
      privateKey,
    });
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    const isValid = /^(0x)?([a-fA-F0-9]{64}|[a-fA-F0-9]{160})$/g.test(
      privateKey,
    );

    return Promise.resolve({
      isValid,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async checkIsDomainName({
    name,
  }: {
    name: string;
  }): Promise<boolean> {
    return ethers.utils.isAddress(name);
  }

  override async resolveDomainName({
    name,
  }: {
    name: string;
  }): Promise<IResolveNameResp> {
    const network = await this.getNetwork();
    const address = delegatedFromEthAddress(
      name,
      network.isTestnet ? CoinType.TEST : CoinType.MAIN,
    );

    return {
      names: [
        {
          subtype: 'fil',
          value: address,
        },
      ],
      showSymbol: 'ETH',
    };
  }
}
