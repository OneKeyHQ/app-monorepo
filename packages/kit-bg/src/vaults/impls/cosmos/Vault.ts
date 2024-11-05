import BigNumber from 'bignumber.js';

import type { ICosmosUnpackedMessage } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import {
  ECosmosMessageType,
  TransactionWrapper,
  TxAminoBuilder,
  TxMsgBuilder,
  defaultAminoMsgOpts,
  getFee,
  getMsgs,
  getSendAmount,
  getSequence,
  pubkeyToAddressDetail,
  serializeSignedTx,
  setFee,
  setSendAmount,
  validateCosmosAddress,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import type { ICosmosProtoMsgsOrWithAminoMsgs } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos/ITxMsgBuilder';
import type {
  ICosmosStdFee,
  IEncodedTxCosmos,
} from '@onekeyhq/core/src/chains/cosmos/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IStakeTxCosmosAmino } from '@onekeyhq/shared/types/staking';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { ClientCosmos } from './sdkCosmos/ClientCosmos';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
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

export default class VaultCosmos extends VaultBase {
  override coreApi = coreChainApi.cosmos.hd;

  txMsgBuilder = new TxMsgBuilder();

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override validateXprvt(): Promise<IXprvtValidation> {
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

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
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

  private _isIbcToken(tokenAddress: string) {
    return (
      tokenAddress.indexOf('/') !== -1 &&
      tokenAddress.split('/')[0].toLowerCase() === 'ibc'
    );
  }

  private async _buildEncodedTxWithFee(params: {
    transfersInfo: ITransferInfo[];
    feeInfo?: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    const { transfersInfo, feeInfo } = params;
    if (transfersInfo.length !== 1) {
      throw new OneKeyInternalError('Only support one transfer');
    }
    const network = await this.getNetwork();
    const networkInfo = await this.getNetworkInfo();
    const mainCoinDenom = networkInfo.nativeTokenAddress ?? '';
    const msgs: ICosmosProtoMsgsOrWithAminoMsgs = {
      protoMsgs: [],
      aminoMsgs: [],
    };
    transfersInfo.forEach((transfer) => {
      const { amount, from, to } = transfer;
      if (transfer.tokenInfo && transfer.tokenInfo.address) {
        const { address, decimals } = transfer.tokenInfo;
        const amountValue = new BigNumber(amount)
          .shiftedBy(decimals)
          .toFixed(0);
        if (transfer.tokenInfo.isNative || this._isIbcToken(address)) {
          const msg = this.txMsgBuilder.makeSendNativeMsg(
            from,
            to,
            amountValue,
            address,
          );
          msgs.protoMsgs.push(...msg.protoMsgs);
          msgs.aminoMsgs.push(...msg.aminoMsgs);
        } else {
          const msg = this.txMsgBuilder.makeSendCwTokenMsg(
            from,
            address,
            to,
            amountValue,
          );
          msgs.protoMsgs.push(...msg.protoMsgs);
          msgs.aminoMsgs.push(...msg.aminoMsgs);
        }
      } else {
        const amountValue = new BigNumber(amount)
          .shiftedBy(network.decimals)
          .toFixed(0);
        const msg = this.txMsgBuilder.makeSendNativeMsg(
          from,
          to,
          amountValue,
          mainCoinDenom,
        );
        msgs.protoMsgs.push(...msg.protoMsgs);
        msgs.aminoMsgs.push(...msg.aminoMsgs);
      }
    });
    const accountInfo =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: network.id,
        accountId: this.accountId,
        withNonce: true,
      });
    if (!accountInfo) {
      throw new Error('Invalid account');
    }
    const txBuilder = new TxAminoBuilder();
    const account = await this.getAccount();
    const pubkey = bufferUtils.hexToBytes(
      hexUtils.stripHexPrefix(account.pub ?? ''),
    );

    const gasLimit = '0';
    const feeAmount = '1'; // cannot be 0, because estimated tx gas will too low

    const tx = txBuilder.makeTxWrapper(msgs, {
      memo: transfersInfo[0].memo || '',
      gasLimit,
      feeAmount,
      pubkey,
      mainCoinDenom,
      chainId: await this.getNetworkChainId(),
      accountNumber: `${accountInfo.accountNumber ?? 0}`,
      nonce: `${accountInfo.nonce ?? 0}`,
    });

    if (feeInfo) {
      return this._attachFeeInfoToEncodedTx({
        encodedTx: tx,
        feeInfo,
      });
    }
    return tx.toObject();
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || transfersInfo.length === 0) {
      throw new Error('transfersInfo is required');
    }
    transfersInfo.forEach((transferInfo) => {
      if (!transferInfo.to) {
        throw new Error('Invalid transferInfo.to params');
      }
    });
    return this._buildEncodedTxWithFee({ transfersInfo });
  }

  override async buildStakeEncodedTx(
    params: IStakeTxCosmosAmino,
  ): Promise<IEncodedTxCosmos> {
    return TransactionWrapper.fromAminoSignDoc(params, undefined).toObject();
  }

  private _getTransactionTypeByMessage(
    message: ICosmosUnpackedMessage,
  ): EDecodedTxActionType {
    if ('unpacked' in message) {
      if (
        message.typeUrl === ECosmosMessageType.SEND ||
        message.typeUrl === defaultAminoMsgOpts.send.native.type
      ) {
        return EDecodedTxActionType.ASSET_TRANSFER;
      }
    }
    return EDecodedTxActionType.UNKNOWN;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;
    const network = await this.getNetwork();
    const account = await this.getAccount();
    const txWrapper = new TransactionWrapper(encodedTx.signDoc, encodedTx.msg);
    const msgs = getMsgs(txWrapper);
    const { stakingInfo } = unsignedTx;

    let actions = [];

    if (stakingInfo) {
      const msg = msgs[0];
      const { validatorAddress } = 'unpacked' in msg ? msg.unpacked : msg.value;
      actions = [
        await this.buildInternalStakingAction({
          accountAddress: account.address,
          stakingInfo,
          stakingToAddress: validatorAddress,
        }),
      ];
    } else {
      for (const msg of msgs) {
        let action: IDecodedTxAction | null = null;
        const actionType = this._getTransactionTypeByMessage(msg);
        if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
          const { amount, fromAddress, toAddress } =
            'unpacked' in msg ? msg.unpacked : msg.value;
          const amounts = amount as Array<{ denom: string; amount: string }>;
          const token = await this.backgroundApi.serviceToken.getToken({
            networkId: network.id,
            accountId: this.accountId,
            tokenIdOnNetwork: amounts[0].denom,
          });
          if (token) {
            const amountNumber = new BigNumber(amounts[0].amount)
              .shiftedBy(-token.decimals)
              .toFixed();
            const amountDenom = token.symbol;

            action = await this.buildTxTransferAssetAction({
              from: fromAddress,
              to: toAddress,
              transfers: [
                {
                  from: fromAddress,
                  to: toAddress,
                  amount: amountNumber,
                  icon: token.logoURI ?? '',
                  symbol: amountDenom,
                  name: token.name,
                  tokenIdOnNetwork: token.address,
                  isNative: amountDenom === network.symbol,
                },
              ],
            });
          }
        }

        if (!action) {
          action = {
            type: EDecodedTxActionType.UNKNOWN,
            direction: EDecodedTxDirection.OTHER,
            unknownAction: {
              from: '',
              to: '',
            },
          };
        }

        if (action) actions.push(action);
      }
    }

    const fee = getFee(txWrapper);
    const sequence = getSequence(txWrapper);

    let feePrice = '0.01';
    if (fee?.gas_limit) {
      feePrice = new BigNumber(fee?.amount[0]?.amount ?? '1')
        .div(fee?.gas_limit)
        .toFixed(6);
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: sequence.toNumber(),
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        common: {
          feeDecimals: network.decimals,
          feeSymbol: network.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
        gas: {
          gasPrice: feePrice,
          gasLimit: fee?.gas_limit,
        },
      },
      extraInfo: null,
      encodedTx,
    };
    return result;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      };
    }
    throw new OneKeyInternalError();
  }

  private async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxCosmos;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxCosmos> {
    const { gas, common } = params.feeInfo;
    const { gasPrice: price, gasLimit: limit } = gas ?? {};

    if (!price || typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }
    const gasLimitNum = new BigNumber(limit);
    const gasPriceNum = new BigNumber(price);
    const amount = gasLimitNum
      .multipliedBy(gasPriceNum)
      .shiftedBy(common.feeDecimals)
      .integerValue(BigNumber.ROUND_CEIL)
      .toString();
    const newAmount = [
      {
        denom: common.feeSymbol,
        amount,
      },
    ];

    const txWrapper = new TransactionWrapper(
      params.encodedTx.signDoc,
      params.encodedTx.msg,
    );
    const fee = getFee(txWrapper);
    const newFee: ICosmosStdFee = {
      amount: newAmount,
      gas_limit: limit,
      payer: fee?.payer ?? '',
      granter: fee?.granter ?? '',
      feePayer: fee?.feePayer ?? '',
    };

    return setFee(txWrapper, newFee).toObject();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    if (!params.unsignedTx || !params.feeInfo) {
      throw new OneKeyInternalError('unsignedTx and feeInfo are required');
    }
    const { unsignedTx, feeInfo } = params;
    if (!unsignedTx.encodedTx) {
      unsignedTx.encodedTx = await this._buildEncodedTxWithFee({
        transfersInfo: unsignedTx.transfersInfo ?? [],
        feeInfo,
      });
    } else {
      unsignedTx.encodedTx = await this._attachFeeInfoToEncodedTx({
        encodedTx: unsignedTx.encodedTx as IEncodedTxCosmos,
        feeInfo,
      });
    }

    if (params.nativeAmountInfo && params.nativeAmountInfo.maxSendAmount) {
      const encodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;
      const txWrapper = new TransactionWrapper(
        encodedTx.signDoc,
        encodedTx.msg,
      );
      const tokenInfo = unsignedTx.transfersInfo?.[0].tokenInfo;
      const amount = new BigNumber(params.nativeAmountInfo.maxSendAmount)
        .shiftedBy(tokenInfo?.decimals ?? 0)
        .toFixed(0, BigNumber.ROUND_FLOOR);
      unsignedTx.encodedTx = setSendAmount(txWrapper, amount).toObject();
    }

    return {
      ...unsignedTx,
      feeInfo,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const { addressPrefix } = await this.getNetworkInfo();
    return validateCosmosAddress({
      address,
      addressPrefix,
    });
  }

  override validateXpub(): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxCosmos | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    const account = await this.getAccount();
    const txWrapper = new TransactionWrapper(
      encodedTx?.signDoc,
      encodedTx?.msg,
    );

    const networkInfo = await this.getNetworkInfo();
    const sendNative = getSendAmount(
      txWrapper,
      networkInfo.nativeTokenAddress ?? '',
    );
    if (sendNative) {
      const fee = getFee(txWrapper);
      const feeAmount = fee.amount.find(
        (e) => e.denom === networkInfo.nativeTokenAddress,
      );
      if (feeAmount) {
        const tokenDetail =
          await this.backgroundApi.serviceToken.fetchTokensDetails({
            networkId: this.networkId,
            accountId: this.accountId,
            contractList: [networkInfo.nativeTokenAddress ?? ''],
            withFrozenBalance: false,
            withCheckInscription: false,
          });
        const balance = new BigNumber(tokenDetail[0].balance);
        const feeNum = new BigNumber(feeAmount.amount);
        if (balance.isLessThan(feeNum.plus(sendNative))) {
          const amount = balance
            .minus(feeNum)
            .toFixed(0, BigNumber.ROUND_FLOOR);
          setSendAmount(txWrapper, amount);
        }
      }
    }

    const rawTx = serializeSignedTx({
      txWrapper,
      signature: {
        signatures: [Buffer.alloc(64, 0)],
      },
      publicKey: {
        pubKey: account.pub ?? '',
      },
    });
    return {
      encodedTx: bufferUtils.bytesToHex(rawTx) as unknown as IEncodedTx,
    };
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new ClientCosmos({ url: params.rpcUrl });
    const start = performance.now();
    const { height } = await client.fetchBlockHeaderV1beta1();
    const bestBlockNumber = parseInt(height, 10);
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber,
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    const client = new ClientCosmos({ url: rpcUrl });
    const txId = await client.broadcastTransaction({ rawTx: signedTx.rawTx });
    console.log('broadcastTransaction Done:', {
      txId,
      rawTx: signedTx.rawTx,
    });

    if (!txId) throw new Error('broadcastTransaction failed');

    return {
      ...signedTx,
      txid: txId,
    };
  }
}
