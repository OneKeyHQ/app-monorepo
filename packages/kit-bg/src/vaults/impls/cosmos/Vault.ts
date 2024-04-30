/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TxMsgBuilder,
  pubkeyToAddressDetail,
  validateCosmosAddress,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import BigNumber from 'bignumber.js';
import { TxProtoBuilder } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos/proto/TxProtoBuilder';
import type { ProtoMsgsOrWithAminoMsgs } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos/ITxMsgBuilder';
import { hexToBytes } from 'viem';
import { stripHexPrefix } from 'ethjs-util';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

export default class VaultCosmos extends VaultBase {
  override coreApi = coreChainApi.cosmos.hd;

  txMsgBuilder = new TxMsgBuilder();

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;
    const { curve, addressPrefix } = networkInfo;
    // cosmos chains share same db account,
    // but address is different from sub chain,
    // so we should recalculate address of each chain

    let address = account.address || externalAccountAddress || '';

    let baseAddress = address;

    // TODO check is hd or imported
    // watching/external/hardware account does not have pub
    if (account.pub) {
      ({ address, baseAddress } = pubkeyToAddressDetail({
        curve,
        addressPrefix,
        publicKey: checkIsDefined(account.pub),
      }));
    }

    return {
      networkId,
      normalizedAddress: baseAddress,
      displayAddress: address,
      address,
      baseAddress,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  private isIbcToken(tokenAddress: string) {
    return (
      tokenAddress.indexOf('/') !== -1 &&
      tokenAddress.split('/')[0].toLowerCase() === 'ibc'
    );
  }

  async _buildEncodedTxWithFee(params: {
    transfersInfo: ITransferInfo[];
    feeInfo?: IFeeInfoUnit;
  }) {
    const { transfersInfo, feeInfo } = params;
    const network = await this.getNetwork();
    const msgs: ProtoMsgsOrWithAminoMsgs = {
      protoMsgs: [],
      aminoMsgs: [],
    };
    transfersInfo.forEach((transfer) => {
      const { amount, from, to } = transfer;
      if (transfer.tokenInfo) {
        const { address, decimals, symbol } = transfer.tokenInfo;
        const amountValue = new BigNumber(amount)
          .shiftedBy(decimals)
          .toFixed();
        if (this.isIbcToken(address)) {
          const msg = this.txMsgBuilder.makeSendNativeMsg(from, to, amountValue, symbol);
          msgs.protoMsgs.push(...msg.protoMsgs);
          msgs.aminoMsgs.push(...msg.aminoMsgs);
        } else {
          const msg = this.txMsgBuilder.makeSendCwTokenMsg(from, address, to, amountValue);
          msgs.protoMsgs.push(...msg.protoMsgs);
          msgs.aminoMsgs.push(...msg.aminoMsgs);
        }
      } else {
        const amountValue = new BigNumber(amount)
          .shiftedBy(network.decimals)
          .toFixed();
        const msg = this.txMsgBuilder.makeSendNativeMsg(from, to, amountValue, network.symbol);
        msgs.protoMsgs.push(...msg.protoMsgs);
        msgs.aminoMsgs.push(...msg.aminoMsgs);
      }
    });
    const accountInfo = await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
      networkId: network.id,
      accountAddress: transfersInfo[0].from,
    });
    if (!accountInfo) {
      throw new Error('Invalid account');
    }
    const txBuilder = new TxProtoBuilder();
    const account = await this.getAccount();
    if (!account.pub) {
      throw new Error('Invalid account');
    }
    const pubkey = hexToBytes(`0x${stripHexPrefix(account.pub)}`);

    let gasLimit = '0';
    let feeAmount = '0';
    let mainCoinDenom = network.symbol;
    if (feeInfo) {
      gasLimit = feeInfo.gas?.gasLimit ?? '0';
      const gasLimitNum = new BigNumber(gasLimit);
      const gasPriceNum = new BigNumber(feeInfo.gas?.gasPrice ?? '0');
      feeAmount = gasLimitNum.multipliedBy(gasPriceNum).toFixed(feeInfo.common.feeDecimals).toString();
      mainCoinDenom = feeInfo.common.feeSymbol;
    }
    
    return txBuilder.makeTxWrapper(msgs, {
      memo: '',
      gasLimit,
      feeAmount,
      pubkey,
      mainCoinDenom,
      chainId: network.id,
      accountNumber: `${accountInfo.accountNumber ?? 0}`,
      nonce: `${accountInfo.nonce ?? 0}`,
    })
  }

  override async buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || transfersInfo.length === 0) {
      throw new Error('transfersInfo is required');
    }
    return await this._buildEncodedTxWithFee({ transfersInfo });
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    if (!params.unsignedTx || !params.feeInfo) {
      throw new OneKeyInternalError('unsignedTx and feeInfo are required');
    }
    const {unsignedTx, feeInfo} = params;
    unsignedTx.encodedTx = await this._buildEncodedTxWithFee({
      transfersInfo: unsignedTx.transfersInfo!,
      feeInfo,
    })
    return {
      ...unsignedTx,
      feeInfo,
    }
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const { addressPrefix } = await this.getNetworkInfo();
    return validateCosmosAddress({
      address,
      addressPrefix,
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }
}
