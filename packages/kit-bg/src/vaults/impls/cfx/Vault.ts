/* eslint-disable @typescript-eslint/no-unused-vars */
import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import { pubkeyToCfxAddress } from '@onekeyhq/core/src/chains/cfx/sdkCfx';
import type { IEncodedTxCfx } from '@onekeyhq/core/src/chains/cfx/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { uncompressPublicKey } from '@onekeyhq/core/src/secret';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import numberUtils, {
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { mergeAssetTransferActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IToken } from '@onekeyhq/shared/types/token';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import { EErc20MethodSelectors } from '../evm/decoder/abi';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { conflux as sdkCfx } from './sdkCfx';
import ClientCfx from './sdkCfx/ClientCfx';

import type { ISdkCfxContract } from './types';
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

const { Conflux, address: confluxAddress } = sdkCfx;

const INFINITE_AMOUNT_HEX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export default class Vault extends VaultBase {
  override coreApi = coreChainApi.cfx.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  async getConfluxClient() {
    return this.getConfluxClientCache();
  }

  private getConfluxClientCache = memoizee(
    async () => {
      const chainId = await this.getNetworkChainId();

      return new Conflux({
        url: '',
        networkId: Number(chainId),
      });
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  private getClientCache = memoizee(
    async () =>
      new ClientCfx({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { networkId } = params;
    const account = params.account as IDBVariantAccount;
    const networkInfo = await this.getNetworkInfo();
    const chainId = await this.getNetworkChainId();

    let cfxAddress = account.address || account.addresses?.[networkId] || '';

    if (account.pub) {
      const compressedPublicKey = bufferUtils.toBuffer(account.pub);
      const uncompressedPublicKey = uncompressPublicKey(
        networkInfo.curve,
        compressedPublicKey,
      );
      cfxAddress = await pubkeyToCfxAddress(uncompressedPublicKey, chainId);
    }

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(cfxAddress);

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

  override buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx> {
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

  _buildEncodedTxFromTransfer(params: {
    transferInfo: ITransferInfo;
  }): Promise<IEncodedTxCfx> {
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

    let amountBN = new BigNumber(transferInfo.amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }

    if (tokenInfo.isNative) {
      const amountHex = toBigIntHex(amountBN.shiftedBy(tokenInfo.decimals));
      return Promise.resolve({
        from: transferInfo.from,
        to: transferInfo.to,
        value: amountHex,
        data: '0x',
      });
    }

    const amountHex = toBigIntHex(amountBN.shiftedBy(tokenInfo.decimals));
    const toAddress = `0x${confluxAddress
      .decodeCfxAddress(transferInfo.to)
      .hexAddress.toString('hex')}`;

    const data = `${EErc20MethodSelectors.tokenTransfer}${defaultAbiCoder
      .encode(['address', 'uint256'], [toAddress, amountHex])
      .slice(2)}`;

    return Promise.resolve({
      from: transferInfo.from,
      to: tokenInfo.address ?? '',
      value: '0x0',
      data,
    });
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCfx;
    const { data, contract, to } = encodedTx;
    const [network, accountAddress] = await Promise.all([
      this.getNetwork(),
      this.getAccountAddress(),
    ]);
    let isNativeTransfer = false;

    if (contract || to) {
      const code = await this._fetchCode(contract ?? to);
      isNativeTransfer = !code || code === '0x';
    } else {
      isNativeTransfer =
        !data || data === '0x' || data === '0x0' || data === '0';
    }

    let action: IDecodedTxAction | undefined = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: encodedTx.from ?? accountAddress,
        to: encodedTx.to,
        icon: network.logoURI ?? '',
      },
    };

    let extraNativeTransferAction: IDecodedTxAction | undefined;

    if (encodedTx.value) {
      const valueBn = new BigNumber(encodedTx.value);
      if (!valueBn.isNaN() && valueBn.gt(0)) {
        extraNativeTransferAction =
          await this._buildTxTransferNativeTokenAction({
            encodedTx,
          });
      }
    }

    if (isNativeTransfer) {
      const actionFromNativeTransfer =
        await this._buildTxTransferNativeTokenAction({
          encodedTx,
        });
      if (actionFromNativeTransfer) {
        action = actionFromNativeTransfer;
      }
      extraNativeTransferAction = undefined;
    } else {
      const actionFromContract = await this._buildTxActionFromContract({
        encodedTx,
      });
      if (actionFromContract) {
        action = actionFromContract;
      }
    }

    const finalActions = mergeAssetTransferActions(
      [action, extraNativeTransferAction].filter(Boolean),
    );

    const decodedTx: IDecodedTx = {
      txid: encodedTx.hash || '',
      owner: accountAddress,
      signer: encodedTx.from || accountAddress,
      nonce: encodedTx.nonce || 0,
      actions: finalActions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      extraInfo: null,
    };

    return decodedTx;
  }

  async _buildTxTransferNativeTokenAction(params: {
    encodedTx: IEncodedTxCfx;
  }) {
    const { encodedTx } = params;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      accountId: this.accountId,
      tokenIdOnNetwork: '',
    });

    if (!nativeToken) return;

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      tokenIdOnNetwork: nativeToken.address,
      icon: nativeToken.logoURI ?? '',
      name: nativeToken.name,
      symbol: nativeToken.symbol,
      amount: new BigNumber(encodedTx.value)
        .shiftedBy(-nativeToken.decimals)
        .toFixed(),
      isNFT: false,
      isNative: true,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      transfers: [transfer],
    });

    return action;
  }

  async _buildTxActionFromContract(params: { encodedTx: IEncodedTxCfx }) {
    const { encodedTx } = params;
    const client = await this.getConfluxClient();
    let action: IDecodedTxAction | undefined;
    try {
      const crc20: ISdkCfxContract = await client.CRC20(
        encodedTx.contract ?? encodedTx.to,
      );
      const abiDecodeResult = crc20.abi.decodeData(encodedTx.data);
      const tokenInfo = await this.backgroundApi.serviceToken.getToken({
        accountId: this.accountId,
        networkId: this.networkId,
        tokenIdOnNetwork: encodedTx.contract ?? encodedTx.to,
      });
      if (abiDecodeResult && tokenInfo) {
        if (
          abiDecodeResult.name === 'transfer' ||
          abiDecodeResult.name === 'transferFrom'
        ) {
          action = await this._buildTxTransferTokenAction({
            encodedTx,
            abiDecodeResult,
            tokenInfo,
          });
        } else if (abiDecodeResult.name === 'approve') {
          action = await this._buildTxApproveTokenAction({
            encodedTx,
            abiDecodeResult,
            tokenInfo,
          });
        }
      }
    } catch (error) {
      // pass
    }
    return action;
  }

  async _buildTxTransferTokenAction(params: {
    encodedTx: IEncodedTxCfx;
    abiDecodeResult: { object: any };
    tokenInfo: IToken;
  }) {
    const { encodedTx, abiDecodeResult, tokenInfo } = params;
    const { from, to, amount, recipient, sender } = abiDecodeResult.object;

    const accountAddress = await this.getAccountAddress();

    const transfer: IDecodedTxTransferInfo = {
      from: from ?? sender ?? encodedTx.from ?? accountAddress,
      to: to ?? recipient,
      tokenIdOnNetwork: tokenInfo.address,
      icon: tokenInfo.logoURI ?? '',
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      amount: chainValueUtils.convertTokenChainValueToAmount({
        value: amount,
        token: tokenInfo,
      }),
      isNFT: false,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.from,
      to: to ?? recipient,
      transfers: [transfer],
    });

    return action;
  }

  async _buildTxApproveTokenAction(params: {
    encodedTx: IEncodedTxCfx;
    abiDecodeResult: { object: any };
    tokenInfo: IToken;
  }) {
    const { encodedTx, abiDecodeResult, tokenInfo } = params;
    const { spender, amount } = abiDecodeResult.object;
    const accountAddress = await this.getAccountAddress();

    const action: IDecodedTxAction = {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: encodedTx.from ?? accountAddress,
        to: encodedTx.to,
        spender,
        amount: chainValueUtils.convertTokenChainValueToAmount({
          value: amount,
          token: tokenInfo,
        }),
        icon: tokenInfo.logoURI ?? '',
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        tokenIdOnNetwork: tokenInfo.address,
        isInfiniteAmount:
          toBigIntHex(new BigNumber(amount)) === INFINITE_AMOUNT_HEX,
      },
    };

    return action;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxCfx);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxCfx,
  ): Promise<IUnsignedTxPro> {
    const client = await this.getClient();
    const { from, to, value, data } = encodedTx;
    const tx = {
      ...encodedTx,
    };

    const [status, estimate] = await Promise.all([
      client.getStatus(),
      client.estimateGasAndCollateral({
        from,
        to,
        value,
        data,
      }),
    ]);

    tx.chainId = new BigNumber(status.chainId).toNumber();
    tx.epochHeight = status.epochNumber;
    tx.storageLimit = new BigNumber(estimate.storageCollateralized).toFixed();

    return Promise.resolve({
      encodedTx: tx,
      nonce: isNil(tx.nonce) ? tx.nonce : new BigNumber(tx.nonce).toNumber(),
    });
  }

  _fetchCode = memoizee(
    async (address: string) => {
      const client = await this.getClient();
      const code = await client.getCode(address);
      return code;
    },
    {
      promise: true,
      max: 10,
      normalizer: ([address]) => address,
    },
  );

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo, nonceInfo, nativeAmountInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxCfx;

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
    encodedTx: IEncodedTxCfx;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxCfx> {
    const { encodedTx, feeInfo } = params;
    const { feeDecimals } = feeInfo.common;

    const encodedTxWithFee = { ...encodedTx };

    if (feeInfo.gas) {
      const { gasPrice, gasLimit } = feeInfo.gas;
      encodedTxWithFee.gas = toBigIntHex(new BigNumber(gasLimit));
      encodedTxWithFee.gasLimit = toBigIntHex(new BigNumber(gasLimit));
      encodedTxWithFee.gasPrice = toBigIntHex(
        new BigNumber(gasPrice).shiftedBy(feeDecimals),
      );
    }
    return Promise.resolve(encodedTxWithFee);
  }

  async _attachNonceInfoToEncodedTx(params: {
    encodedTx: IEncodedTxCfx;
    nonceInfo: { nonce: number };
  }): Promise<IEncodedTxCfx> {
    const { encodedTx, nonceInfo } = params;
    const tx = {
      ...encodedTx,
      nonce: nonceInfo.nonce,
    };

    return Promise.resolve(tx);
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxCfx;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;
    const network = await this.getNetwork();

    let newValue = encodedTx.value;

    if (!isNil(nativeAmountInfo.maxSendAmount)) {
      newValue = numberUtils.numberToHex(
        chainValueUtils.convertAmountToChainValue({
          value: nativeAmountInfo.maxSendAmount,
          network,
        }),
      );
    }

    const tx = {
      ...encodedTx,
      value: newValue,
    };
    return Promise.resolve(tx);
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = confluxAddress.isValidCfxAddress(address);
    if (isValid) {
      return Promise.resolve({
        normalizedAddress: address.toLowerCase(),
        displayAddress: address.toLowerCase(),
        isValid,
      });
    }

    return Promise.resolve({
      normalizedAddress: '',
      displayAddress: '',
      isValid,
    });
  }

  override async addressFromBase(account: IDBAccount) {
    const chainId = await this.getNetworkChainId();
    return confluxAddress.encodeCfxAddress(
      account.address,
      parseInt(chainId, 10),
    );
  }

  override async addressToBase(address: string) {
    return Promise.resolve(
      `0x${confluxAddress
        .decodeCfxAddress(address)
        .hexAddress.toString('hex')}`,
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
    return super.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxCfx | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    const { chainId, nonce, from, to, data, value, epochHeight, storageLimit } =
      encodedTx;
    return Promise.resolve({
      encodedTx: {
        chainId,
        nonce,
        from,
        to,
        data,
        value,
        epochHeight,
        storageLimit,
      },
    });
  }
}
