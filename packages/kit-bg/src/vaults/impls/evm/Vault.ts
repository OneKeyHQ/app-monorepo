import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, isNumber } from 'lodash';

import { validateEvmAddress } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import {
  EthersJsonRpcProvider,
  ethers,
} from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyError, OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import numberUtils, {
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { mergeAssetTransferActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IAddressValidation,
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
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
import type {
  IEstimateGasParams,
  IFeeInfoUnit,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';
import type { IToken } from '@onekeyhq/shared/types/token';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  EReplaceTxType,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import {
  EWrappedType,
  type IApproveInfo,
  type IBroadcastTransactionByCustomRpcParams,
  type IBuildAccountAddressDetailParams,
  type IBuildDecodedTxParams,
  type IBuildEncodedTxParams,
  type IBuildUnsignedTxParams,
  type IGetPrivateKeyFromImportedParams,
  type IGetPrivateKeyFromImportedResult,
  type INativeAmountInfo,
  type ITokenApproveInfo,
  type ITransferInfo,
  type ITransferPayload,
  type IUpdateUnsignedTxParams,
  type IValidateGeneralInputParams,
  type IWrappedInfo,
} from '../../types';

import { EVMContractDecoder } from './decoder';
import {
  EErc1155MethodSelectors,
  EErc1155TxDescriptionName,
  EErc20MethodSelectors,
  EErc20TxDescriptionName,
  EErc721MethodSelectors,
  EErc721TxDescriptionName,
  EWrapperTokenMethodSelectors,
} from './decoder/abi';
import {
  InfiniteAmountText,
  checkIsEvmNativeTransfer,
  formatValue,
  parseToNativeTx,
} from './decoder/utils';
import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringQr } from './KeyringQr';
import { KeyringWatching } from './KeyringWatching';
import { ClientEvm } from './sdkEvm/ClientEvm';
import { EvmApiProvider } from './sdkEvm/EvmApiProvider';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

// evm vault
export default class Vault extends VaultBase {
  override coreApi = coreChainApi.evm.hd;

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: KeyringQr,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override validateXprvt(): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false, // EVM not support xprvt
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId, externalAccountAddress } = params;

    const address = account.address || externalAccountAddress || '';

    // all evm chain shared same db account and same address, so we just validate db address only,
    // do not need recalculate address for each sub chain

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

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxEvm> {
    const { transfersInfo, approveInfo, wrappedInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(params);
    }

    if (approveInfo) {
      return this._buildEncodeTxFromApprove(params);
    }

    if (wrappedInfo) {
      return this._buildEncodedTxFromWrapperToken(params);
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromWrapperToken(params: IBuildEncodedTxParams) {
    const { wrappedInfo } = params;
    const { from, amount, contract, type } = wrappedInfo as IWrappedInfo;
    const network = await this.getNetwork();
    const methodID =
      type === EWrappedType.DEPOSIT
        ? EWrapperTokenMethodSelectors.deposit
        : EWrapperTokenMethodSelectors.withdraw;

    const amountHex = toBigIntHex(
      new BigNumber(amount).shiftedBy(network.decimals),
    );

    const data = `${methodID}${defaultAbiCoder
      .encode(['uint256'], [amountHex])
      .slice(2)}`;

    if (type === EWrappedType.DEPOSIT) {
      return {
        from,
        to: contract,
        value: amountHex,
        data,
      };
    }

    return {
      from,
      to: contract,
      value: '0x0',
      data,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx, transferPayload } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
    const { swapInfo, stakingInfo } = unsignedTx;

    const [network, accountAddress, nativeTx] = await Promise.all([
      this.getNetwork(),
      this.getAccountAddress(),
      parseToNativeTx({ encodedTx }),
    ]);

    let action: IDecodedTxAction | undefined = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: encodedTx.from ?? accountAddress,
        to: encodedTx.to,
        icon: network.logoURI ?? '',
      },
    };
    let extraNativeTransferAction: IDecodedTxAction | undefined;

    if (swapInfo) {
      action = await this.buildInternalSwapAction({
        swapInfo,
        swapData: encodedTx.data,
        swapToAddress: encodedTx.to,
      });
    } else if (stakingInfo) {
      action = await this.buildInternalStakingAction({
        stakingInfo,
        accountAddress,
        stakingData: encodedTx.data,
        stakingToAddress: encodedTx.to,
      });
    } else {
      if (encodedTx.value) {
        const valueBn = new BigNumber(encodedTx.value);
        if (!valueBn.isNaN() && valueBn.gt(0)) {
          extraNativeTransferAction =
            await this._buildTxTransferNativeTokenAction({
              encodedTx,
            });
        }
      }

      if (checkIsEvmNativeTransfer({ tx: nativeTx })) {
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
          transferPayload,
        });
        if (actionFromContract) {
          action = actionFromContract;
        }
      }
    }

    return this._buildDecodedTx({
      encodedTx,
      action,
      extraNativeTransferAction,
    });
  }

  async _buildTxActionFromContract(params: {
    encodedTx: IEncodedTxEvm;
    transferPayload?: ITransferPayload;
  }) {
    let action: IDecodedTxAction | undefined;
    const { encodedTx, transferPayload } = params;
    const nativeTx = await parseToNativeTx({
      encodedTx,
    });
    const decoder = new EVMContractDecoder();
    const erc20TxDesc = decoder.parseERC20(nativeTx);
    if (erc20TxDesc) {
      action = await this._buildTxTokenAction({
        encodedTx,
        txDesc: erc20TxDesc,
        transferPayload,
      });
      if (action) return action;
    }

    const erc721TxDesc = decoder.parseERC721(nativeTx);
    if (erc721TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc721TxDesc,
        transferPayload,
      });
      if (action) return action;
    }

    const erc1155TxDesc = decoder.parseERC1155(nativeTx);
    if (erc1155TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc1155TxDesc,
        transferPayload,
      });
      if (action) return action;
    }

    if (erc20TxDesc || erc721TxDesc || erc1155TxDesc) {
      action = await this._buildTxFunctionCallAction({
        encodedTx,
        txDesc: (erc20TxDesc ||
          erc721TxDesc ||
          erc1155TxDesc) as ethers.utils.TransactionDescription,
      });
    }

    return action;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      const unsignedTx = await this._buildUnsignedTxFromEncodedTx(
        encodedTx as IEncodedTxEvm,
      );

      if (params.prevNonce && isNumber(params.prevNonce)) {
        return this.updateUnsignedTx({
          unsignedTx,
          nonceInfo: {
            nonce: new BigNumber(params.prevNonce).plus(1).toNumber(),
          },
        });
      }
      return unsignedTx;
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const {
      unsignedTx,
      feeInfo,
      nonceInfo,
      nativeAmountInfo,
      tokenApproveInfo,
    } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxEvm;

    if (tokenApproveInfo && tokenApproveInfo.allowance !== '') {
      encodedTxNew = await this._updateTokenApproveInfo({
        encodedTx: encodedTxNew,
        tokenApproveInfo,
      });
    }

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

  override async validateXpub(): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false, // EVM not support xpub
    });
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    return validateEvmAddress(address);
  }

  async _buildDecodedTx(params: {
    encodedTx: IEncodedTxEvm;
    action: IDecodedTxAction | undefined;
    extraNativeTransferAction: IDecodedTxAction | undefined;
  }): Promise<IDecodedTx> {
    const { encodedTx, action, extraNativeTransferAction } = params;
    const accountAddress = await this.getAccountAddress();
    const finalActions = mergeAssetTransferActions(
      [action, extraNativeTransferAction].filter(Boolean),
    );

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: accountAddress,
      signer: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      nonce: Number(encodedTx.nonce) ?? 0,
      actions: finalActions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      extraInfo: null,
    };
    return decodedTx;
  }

  async _buildEncodedTxFromTransfer(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    const transfersInfo = params.transfersInfo as ITransferInfo[];
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      const { from, to, amount, tokenInfo, nftInfo } = transferInfo;

      if (!transferInfo.to) {
        throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
      }

      if (!tokenInfo && !nftInfo) {
        throw new Error(
          'buildEncodedTx ERROR: transferInfo.tokenInfo and transferInfo.nftInfo are both missing',
        );
      }
      if (nftInfo) {
        const { nftAddress, nftId, nftType } = nftInfo;
        const data = await this._buildEncodedDataFromTransferNFT({
          from,
          to,
          id: nftId,
          amount,
          type: nftType,
        });

        return {
          from,
          to: nftAddress,
          value: '0x0',
          data,
        };
      }

      if (tokenInfo) {
        if (isNil(tokenInfo.decimals)) {
          throw new Error(
            'buildEncodedTx ERROR: transferInfo.tokenInfo.decimals missing',
          );
        }

        // native token transfer
        if (tokenInfo.isNative) {
          return {
            from,
            to,
            value: numberUtils.numberToHex(
              chainValueUtils.convertAmountToChainValue({
                network,
                value: amount,
              }),
            ),
            data: '0x',
          };
        }

        // token address is required when building erc20 token transfer
        if (!tokenInfo.address) {
          throw new Error(
            'buildEncodedTx ERROR: transferInfo.tokenInfo.address missing',
          );
        }

        // token transfer
        const data = await this._buildEncodedDataFromTransferToken({
          to,
          amount,
          decimals: tokenInfo.decimals,
        });
        return {
          from,
          to: tokenInfo.address,
          value: '0x0',
          data,
        };
      }
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodeTxFromApprove(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxEvm> {
    const { approveInfo } = params;

    const { owner, spender, amount, tokenInfo, isMax } =
      approveInfo as IApproveInfo;

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const amountBN = new BigNumber(amount);
    const amountHex = toBigIntHex(
      amountBN.isNaN() || isMax
        ? new BigNumber(2).pow(256).minus(1)
        : amountBN.shiftedBy(tokenInfo.decimals),
    );
    const data = `${EErc20MethodSelectors.tokenApprove}${defaultAbiCoder
      .encode(['address', 'uint256'], [spender, amountHex])
      .slice(2)}`;
    return {
      from: owner,
      to: tokenInfo.address,
      value: '0x0',
      data,
    };
  }

  async _buildEncodedDataFromTransferNFT(params: {
    type: ENFTType;
    from: string;
    to: string;
    id: string;
    amount: string;
  }) {
    const { type, from, to, id, amount } = params;
    if (type === ENFTType.ERC721) {
      return `${EErc721MethodSelectors.safeTransferFrom}${defaultAbiCoder
        .encode(['address', 'address', 'uint256'], [from, to, id])
        .slice(2)}`;
    }
    return `${EErc1155MethodSelectors.safeTransferFrom}${defaultAbiCoder
      .encode(
        ['address', 'address', 'uint256', 'uint256', 'bytes'],
        [from, to, id, amount, '0x00'],
      )
      .slice(2)}`;
  }

  async _buildEncodedDataFromTransferToken(params: {
    to: string;
    amount: string;
    decimals: number;
  }) {
    const { to, amount, decimals } = params;
    const amountBN = new BigNumber(amount);
    const amountHex = toBigIntHex(amountBN.shiftedBy(decimals));

    const data = `${EErc20MethodSelectors.tokenTransfer}${defaultAbiCoder
      .encode(['address', 'uint256'], [to, amountHex])
      .slice(2)}`;

    return data;
  }

  async _buildEncodedTxFromBatchTransfer(transfersInfo: ITransferInfo[]) {
    console.log(transfersInfo);
    // TODO EVM batch transfer through contract
    return {
      from: '',
      to: '',
      value: '0',
      data: '0x',
    };
  }

  async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    feeInfo: IFeeInfoUnit;
  }): Promise<IEncodedTxEvm> {
    const { encodedTx, feeInfo } = params;
    const gasInfo = feeInfo.gasEIP1559 ?? feeInfo.gas;
    const { feeDecimals } = feeInfo.common;

    const encodedTxWithFee = { ...encodedTx };

    if (!isNil(gasInfo?.gasLimit)) {
      encodedTxWithFee.gas = gasInfo.gasLimit;
      encodedTxWithFee.gasLimit = gasInfo.gasLimit;
    }

    if (feeInfo.gasEIP1559) {
      encodedTxWithFee.maxFeePerGas = toBigIntHex(
        new BigNumber(feeInfo.gasEIP1559.maxFeePerGas ?? 0).shiftedBy(
          feeDecimals,
        ),
      );
      encodedTxWithFee.maxPriorityFeePerGas = toBigIntHex(
        new BigNumber(feeInfo.gasEIP1559.maxPriorityFeePerGas ?? 0).shiftedBy(
          feeDecimals,
        ),
      );
      delete encodedTxWithFee.gasPrice;
    } else if (feeInfo.gas) {
      encodedTxWithFee.gasPrice = toBigIntHex(
        new BigNumber(feeInfo.gas.gasPrice).shiftedBy(feeDecimals),
      );
      delete encodedTxWithFee.maxFeePerGas;
      delete encodedTxWithFee.maxPriorityFeePerGas;
    }
    return Promise.resolve(encodedTxWithFee);
  }

  async _attachNonceInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    nonceInfo: { nonce: number };
  }): Promise<IEncodedTxEvm> {
    const { encodedTx, nonceInfo } = params;
    const tx = {
      ...encodedTx,
      nonce: nonceInfo.nonce,
    };

    return Promise.resolve(tx);
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxEvm;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;
    const network = await this.getNetwork();

    let newValue = encodedTx.value;

    if (!isNil(nativeAmountInfo.maxSendAmount)) {
      newValue = chainValueUtils.fixNativeTokenMaxSendAmount({
        amount: nativeAmountInfo.maxSendAmount,
        network,
      });
    } else if (!isNil(nativeAmountInfo.amount)) {
      newValue = numberUtils.numberToHex(
        chainValueUtils.convertAmountToChainValue({
          value: nativeAmountInfo.amount,
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

  async _updateTokenApproveInfo(params: {
    encodedTx: IEncodedTxEvm;
    tokenApproveInfo: ITokenApproveInfo;
  }) {
    const { encodedTx, tokenApproveInfo } = params;
    const action = await this._buildTxActionFromContract({ encodedTx });
    if (
      action &&
      action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      action.tokenApprove
    ) {
      const { allowance, isUnlimited } = tokenApproveInfo;
      const { spender, decimals } = action.tokenApprove;

      const amountHex = toBigIntHex(
        isUnlimited
          ? new BigNumber(2).pow(256).minus(1)
          : new BigNumber(allowance).shiftedBy(decimals),
      );

      const data = `${EErc20MethodSelectors.tokenApprove}${defaultAbiCoder
        .encode(['address', 'uint256'], [spender, amountHex])
        .slice(2)}`;

      return {
        ...encodedTx,
        data,
      };
    }
    return encodedTx;
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxEvm,
  ): Promise<IUnsignedTxPro> {
    const tx = {
      ...encodedTx,
    };
    const chainIdHex = await this.getNetworkChainId({ hex: true });
    const chainIdNum = chainIdHex;

    tx.chainId = chainIdNum;
    return Promise.resolve({
      encodedTx: tx,
      nonce: isNil(tx.nonce) ? tx.nonce : new BigNumber(tx.nonce).toNumber(),
    });
  }

  async _buildTxFunctionCallAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
  }) {
    const { encodedTx, txDesc } = params;

    const [network, accountAddress] = await Promise.all([
      this.getNetwork(),
      this.getAccountAddress(),
    ]);

    const action: IDecodedTxAction = {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        from: encodedTx.from ?? accountAddress,
        to: encodedTx.to,
        functionName: txDesc.name,
        functionSignature: txDesc.signature,
        args: txDesc.args.map((arg) => String(arg)),
        icon: network.logoURI ?? '',
      },
    };

    return action;
  }

  async _buildTxTokenAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
    transferPayload?: ITransferPayload;
  }) {
    const { encodedTx, txDesc, transferPayload } = params;

    const token = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: encodedTx.to,
    });

    if (!token) return;

    if (
      txDesc.name === EErc20TxDescriptionName.TransferFrom ||
      txDesc.name === EErc20TxDescriptionName.Transfer
    ) {
      return this._buildTxTransferTokenAction({
        encodedTx,
        txDesc,
        token,
        transferPayload,
      });
    }

    if (txDesc.name === EErc20TxDescriptionName.Approve) {
      return this._buildTxApproveTokenAction({
        encodedTx,
        txDesc,
        token,
      });
    }
  }

  async _buildTxTransferTokenAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
    token: IToken;
    transferPayload?: ITransferPayload;
  }) {
    const { encodedTx, token, txDesc, transferPayload } = params;

    let from = encodedTx.from;
    let recipient = encodedTx.to;
    let value = ethers.BigNumber.from(0);

    // Function:  transfer(address _to, uint256 _value)
    if (txDesc?.name === EErc20TxDescriptionName.Transfer) {
      from = encodedTx.from;
      recipient = txDesc.args[0] as string;
      value = txDesc.args[1] as ethers.BigNumber;
    }

    // Function:  transferFrom(address from, address to, uint256 value)
    if (txDesc?.name === EErc20TxDescriptionName.TransferFrom) {
      from = txDesc?.args[0] as string;
      recipient = txDesc?.args[1] as string;
      value = txDesc?.args[2] as ethers.BigNumber;
    }

    const amount = chainValueUtils.convertTokenChainValueToAmount({
      value: value.toString(),
      token,
    });

    if (
      transferPayload?.originalRecipient &&
      transferPayload.originalRecipient.toLowerCase() ===
        recipient.toLowerCase()
    ) {
      recipient = transferPayload.originalRecipient;
    }

    const transfer: IDecodedTxTransferInfo = {
      from,
      to: recipient,
      tokenIdOnNetwork: token.address,
      icon: token.logoURI ?? '',
      name: token.name,
      symbol: token.symbol,
      amount,
      isNFT: false,
    };

    const action = await this.buildTxTransferAssetAction({
      from: encodedTx.from,
      to: recipient,
      transfers: [transfer],
    });

    return action;
  }

  async _buildTxApproveTokenAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
    token: IToken;
  }): Promise<IDecodedTxAction> {
    const { encodedTx, txDesc, token } = params;
    const spender = txDesc?.args[0] as string;
    const value = txDesc?.args[1] as ethers.BigNumber;
    const amount = formatValue(value, token.decimals);
    const accountAddress = await this.getAccountAddress();

    const action: IDecodedTxAction = {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: encodedTx.from ?? accountAddress,
        to: encodedTx.to,
        spender,
        amount,
        icon: token.logoURI ?? '',
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        tokenIdOnNetwork: token.address,
        isInfiniteAmount: amount === InfiniteAmountText,
      },
    };

    return action;
  }

  async _buildTxTransferNativeTokenAction(params: {
    encodedTx: IEncodedTxEvm;
  }) {
    const { encodedTx } = params;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
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

  async _buildTxTransferNFTAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
    transferPayload?: ITransferPayload;
  }) {
    const { encodedTx, txDesc, transferPayload } = params;
    const accountAddress = await this.getAccountAddress();

    if (
      txDesc.name !== EErc721TxDescriptionName.SafeTransferFrom &&
      txDesc.name !== EErc1155TxDescriptionName.SafeTransferFrom
    )
      return;

    const [from, to, nftId, amount] =
      txDesc?.args.map((arg) => String(arg)) || [];

    const nft = await this.backgroundApi.serviceNFT.getNFT({
      accountId: this.accountId,
      networkId: this.networkId,
      collectionAddress: encodedTx.to,
      nftId,
    });

    let nftAmount = amount;

    if (!nft) return;

    // For NFT ERC721, the amount is always 1
    if (txDesc.name === EErc721TxDescriptionName.SafeTransferFrom) {
      nftAmount = isNil(amount) ? '1' : amount;
    }

    let recipient = to;
    if (
      transferPayload?.originalRecipient &&
      transferPayload.originalRecipient.toLowerCase() ===
        recipient.toLowerCase()
    ) {
      recipient = transferPayload.originalRecipient;
    }

    const transfer: IDecodedTxTransferInfo = {
      from,
      to: recipient,
      tokenIdOnNetwork: nftId,
      amount: nftAmount,
      name: nft.metadata?.name ?? '',
      icon: nft.metadata?.image ?? '',
      symbol: nft.metadata?.name ?? '',
      isNFT: true,
    };

    return this.buildTxTransferAssetAction({
      from: encodedTx.from ?? accountAddress,
      to: recipient,
      transfers: [transfer],
    });
  }

  // TODO memo cache
  async getEthersClient() {
    const rpcUrl = await this.getRpcUrl();
    const client = new EthersJsonRpcProvider(rpcUrl);
    return client;
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxEvm | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }
    const { chainId, nonce, from, to, data, value } = encodedTx;
    let transferValue = value;

    const nativeTx = await parseToNativeTx({ encodedTx });

    // try using value=0 to calculate native transfer gas limit to avoid maximum transfer failure.
    if (checkIsEvmNativeTransfer({ tx: nativeTx })) {
      transferValue =
        // the estimated limit will be insufficient when value is 0x0 on filecoin evm
        this.networkId === getNetworkIdsMap().fevm ? '0x1' : '0x0';
    }

    return Promise.resolve({
      encodedTx: {
        chainId,
        nonce,
        from,
        to,
        data,
        value: transferValue,
      },
    });
  }

  override async isEarliestLocalPendingTx({
    encodedTx,
  }: {
    encodedTx: IEncodedTxEvm;
  }): Promise<boolean> {
    const accountAddress = await this.getAccountAddress();
    const minPendingTxNonce =
      await this.backgroundApi.serviceHistory.getLocalHistoryMinPendingNonce({
        networkId: this.networkId,
        accountAddress,
      });

    return new BigNumber(encodedTx.nonce ?? 0).isEqualTo(
      minPendingTxNonce ?? 0,
    );
  }

  override async buildReplaceEncodedTx({
    decodedTx,
    replaceType,
  }: {
    decodedTx: IDecodedTx;
    replaceType: EReplaceTxType;
  }) {
    let encodedTxOrigin: IEncodedTxEvm | undefined;
    const { encodedTxEncrypted, nonce } = decodedTx;
    const encodedTx = decodedTx.encodedTx as IEncodedTxEvm;
    if (encodedTxEncrypted) {
      try {
        encodedTxOrigin = JSON.parse(
          await this.backgroundApi.servicePassword.decryptByInstanceId(
            encodedTxEncrypted,
          ),
        );
      } catch (error) {
        console.error(error);
        encodedTxOrigin = {
          from: '-',
          to: '-',
          value: '-',
          data: '-',
        };
      }
    }

    if (isNil(nonce) || !isNumber(nonce) || nonce < 0) {
      throw new OneKeyError('speedUpOrCancelTx ERROR: nonce is missing!');
    }

    // set only fields of IEncodedTxEvm
    const encodedTxEvm: IEncodedTxEvm = {
      from: encodedTx.from,
      to: encodedTx.to,
      value: encodedTx.value,
      data: encodedTx.data,
      // must be number, 0x string will send new tx
      nonce,

      // keep origin fee info
      gas: encodedTx.gas,
      gasLimit: encodedTx.gasLimit,
      gasPrice: encodedTx.gasPrice,
      maxFeePerGas: encodedTx.maxFeePerGas,
      maxPriorityFeePerGas: encodedTx.maxPriorityFeePerGas,
    };

    if (replaceType === EReplaceTxType.Cancel) {
      encodedTxEvm.to = encodedTxEvm.from;
      encodedTxEvm.value = '0x0';
      encodedTxEvm.data = '0x';
    }
    if (replaceType === EReplaceTxType.SpeedUp) {
      if (
        encodedTxOrigin &&
        (encodedTxOrigin.from !== encodedTxEvm.from ||
          encodedTxOrigin.to !== encodedTxEvm.to ||
          encodedTxOrigin.value !== encodedTxEvm.value ||
          encodedTxOrigin.data !== encodedTxEvm.data ||
          !new BigNumber(encodedTxEvm.nonce || '0').eq(
            encodedTxOrigin.nonce || '0',
          ))
      ) {
        throw new OneKeyError(
          'Speedup failed. History transaction data not matched',
        );
      }
    }

    return encodedTxEvm;
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new ClientEvm(params.rpcUrl);
    const { chainId } = await client.getChainId();
    if (
      params.validateChainId &&
      Number(chainId) !== Number(await this.getNetworkChainId())
    ) {
      throw new OneKeyError('Invalid chainId');
    }
    const start = performance.now();
    const result = await client.getInfo();
    return {
      chainId: Number(chainId),
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: result.bestBlockNumber,
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const client = new ClientEvm(rpcUrl);
    const txid = await client.broadcastTransaction(signedTx.rawTx);
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }

  // RPC Client
  async getRpcClient() {
    const rpcInfo =
      await this.backgroundApi.serviceCustomRpc.getCustomRpcForNetwork(
        this.networkId,
      );
    if (!rpcInfo?.rpc) {
      throw new OneKeyInternalError('No RPC url');
    }

    const provider = new EvmApiProvider({
      url: rpcInfo.rpc,
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
    });
    return provider;
  }

  override async fetchAccountDetailsByRpc(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const provider = await this.getRpcClient();
    const resp = await provider.getAccount(params);
    return resp;
  }

  override async fetchTokenListByRpc(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const provider = await this.getRpcClient();
    const resp = await provider.listAccountToken(params);
    return resp;
  }

  override async fetchTokenDetailsByRpc(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    const provider = await this.getRpcClient();
    const resp = await provider.queryAccountToken(params);
    return resp;
  }

  override async estimateFeeByRpc(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const provider = await this.getRpcClient();
    const resp = await provider.estimateFee(params);
    return resp;
  }

  override async fetchAccountHistoryDetailByRpc(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const provider = await this.getRpcClient();
    const resp = await provider.getAccountHistoryDetail(params);
    return resp;
  }

  override async checkFeeSupportInfo(params: IMeasureRpcStatusParams) {
    const client = new ClientEvm(params.rpcUrl);
    return client.checkEIP1559Support();
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const provider = await this.getRpcClient();
    return provider.client.call(request.method, request.params as any);
  }
}
