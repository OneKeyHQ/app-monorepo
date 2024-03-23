import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import { validateEvmAddress } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import {
  EthersJsonRpcProvider,
  ethers,
} from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import numberUtils, {
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  buildTxActionDirection,
  mergeAssetTransferActions,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionAssetTransfer,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import {
  EWrappedType,
  type IApproveInfo,
  type IBroadcastTransactionParams,
  type IBuildAccountAddressDetailParams,
  type IBuildDecodedTxParams,
  type IBuildEncodedTxParams,
  type IBuildUnsignedTxParams,
  type IGetPrivateKeyFromImportedParams,
  type IGetPrivateKeyFromImportedResult,
  type INativeAmountInfo,
  type ITransferInfo,
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
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';

// evm vault
export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new Error('Method not implemented.');
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
    const { unsignedTx } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
    const { swapInfo } = unsignedTx;

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
      action = await this._buildTxActionFromSwap({
        encodedTx,
        swapInfo,
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

  async _buildTxActionFromContract(params: { encodedTx: IEncodedTxEvm }) {
    let action: IDecodedTxAction | undefined;
    const { encodedTx } = params;
    const nativeTx = await parseToNativeTx({
      encodedTx,
    });
    const decoder = new EVMContractDecoder();
    const erc20TxDesc = decoder.parseERC20(nativeTx);
    if (erc20TxDesc) {
      action = await this._buildTxTokenAction({
        encodedTx,
        txDesc: erc20TxDesc,
      });
      if (action) return action;
    }

    const erc721TxDesc = decoder.parseERC721(nativeTx);
    if (erc721TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc721TxDesc,
      });
      if (action) return action;
    }

    const erc1155TxDesc = decoder.parseERC1155(nativeTx);
    if (erc1155TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc1155TxDesc,
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
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxEvm);
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo, nonceInfo, nativeAmountInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxEvm;

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

    let nativeAmount = '0';
    let nativeAmountValue = '0';

    finalActions.forEach((item) => {
      if (item.type === EDecodedTxActionType.ASSET_TRANSFER) {
        nativeAmount = new BigNumber(nativeAmount)
          .plus(item.assetTransfer?.nativeAmount ?? 0)
          .toFixed();
        nativeAmountValue = new BigNumber(nativeAmountValue)
          .plus(item.assetTransfer?.nativeAmountValue ?? 0)
          .toFixed();
      }
    });

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
      nativeAmount,
      nativeAmountValue,
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
  }) {
    const { encodedTx, txDesc } = params;

    const token = await this.backgroundApi.serviceToken.getToken({
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
  }) {
    const { encodedTx, token, txDesc } = params;

    let from = encodedTx.from.toLowerCase();
    let recipient = encodedTx.to.toLowerCase();
    let value = ethers.BigNumber.from(0);

    // Function:  transfer(address _to, uint256 _value)
    if (txDesc?.name === EErc20TxDescriptionName.Transfer) {
      from = encodedTx.from.toLowerCase();
      recipient = (txDesc.args[0] as string).toLowerCase();
      value = txDesc.args[1] as ethers.BigNumber;
    }

    // Function:  transferFrom(address from, address to, uint256 value)
    if (txDesc?.name === EErc20TxDescriptionName.TransferFrom) {
      from = (txDesc?.args[0] as string).toLowerCase();
      recipient = (txDesc?.args[1] as string).toLowerCase();
      value = txDesc?.args[2] as ethers.BigNumber;
    }

    const amount = chainValueUtils.convertTokenChainValueToAmount({
      value: value.toString(),
      token,
    });

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

    const action = await this._buildTxTransferAssetAction({
      from: encodedTx.from,
      to: encodedTx.to,
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
    const spender = (txDesc?.args[0] as string).toLowerCase();
    const value = txDesc?.args[1] as ethers.BigNumber;
    const amount = formatValue(value, token.decimals);
    const accountAddress = await this.getAccountAddress();

    const action: IDecodedTxAction = {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: encodedTx.from ?? accountAddress,
        to: spender,
        amount,
        icon: token.logoURI ?? '',
        name: token.name,
        symbol: token.symbol,
        tokenIdOnNetwork: token.address,
        isMax: amount === InfiniteAmountText,
      },
    };

    return action;
  }

  async _buildTxActionFromSwap(params: {
    encodedTx: IEncodedTxEvm;
    swapInfo: ISwapTxInfo;
  }) {
    const { encodedTx, swapInfo } = params;
    const swapSendToken = swapInfo.sender.token;
    const action = await this._buildTxTransferAssetAction({
      from: swapInfo.accountAddress,
      to: encodedTx.to,
      transfers: [
        {
          from: swapInfo.accountAddress,
          to: encodedTx.to,
          tokenIdOnNetwork: swapSendToken.contractAddress,
          icon: swapSendToken.logoURI ?? '',
          name: swapSendToken.name ?? '',
          symbol: swapSendToken.symbol,
          amount: swapInfo.sender.amount,
          isNFT: false,
          isNative: swapSendToken.isNative,
        },
      ],
    });
    return action;
  }

  async _buildTxTransferNativeTokenAction(params: {
    encodedTx: IEncodedTxEvm;
  }) {
    const { encodedTx } = params;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
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

    const action = await this._buildTxTransferAssetAction({
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      transfers: [transfer],
    });

    return action;
  }

  async _buildTxTransferAssetAction(params: {
    from: string;
    to: string;
    transfers: IDecodedTxTransferInfo[];
  }): Promise<IDecodedTxAction> {
    const { from, to, transfers } = params;
    const [accountAddress, network] = await Promise.all([
      this.getAccountAddress(),
      this.getNetwork(),
    ]);

    let sendNativeTokenAmountBN = new BigNumber(0);

    const assetTransfer: IDecodedTxActionAssetTransfer = {
      from,
      to,
      sends: [],
      receives: [],
    };

    transfers.forEach((transfer) => {
      if (
        buildTxActionDirection({
          from: transfer.from,
          to: transfer.to,
          accountAddress,
        }) === EDecodedTxDirection.OUT
      ) {
        assetTransfer.sends.push(transfer);
        if (transfer.isNative) {
          sendNativeTokenAmountBN = sendNativeTokenAmountBN.plus(
            new BigNumber(transfer.amount),
          );
        }
      } else {
        assetTransfer.receives.push(transfer);
      }
    });

    assetTransfer.nativeAmount = sendNativeTokenAmountBN.toFixed();
    assetTransfer.nativeAmountValue = chainValueUtils.convertAmountToChainValue(
      {
        value: sendNativeTokenAmountBN,
        network,
      },
    );

    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer,
    };
  }

  async _buildTxTransferNFTAction(params: {
    encodedTx: IEncodedTxEvm;
    txDesc: ethers.utils.TransactionDescription;
  }) {
    const { encodedTx, txDesc } = params;
    const accountAddress = await this.getAccountAddress();

    if (
      txDesc.name !== EErc721TxDescriptionName.SafeTransferFrom &&
      txDesc.name !== EErc1155TxDescriptionName.SafeTransferFrom
    )
      return;

    const [from, to, nftId, amount] =
      txDesc?.args.map((arg) => String(arg)) || [];

    const nft = await this.backgroundApi.serviceNFT.getNFT({
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

    const transfer: IDecodedTxTransferInfo = {
      from,
      to,
      tokenIdOnNetwork: nftId,
      amount: nftAmount,
      name: nft.metadata?.name ?? '',
      icon: nft.metadata?.image ?? '',
      symbol: nft.metadata?.name ?? '',
      isNFT: true,
    };

    return this._buildTxTransferAssetAction({
      from: encodedTx.from ?? accountAddress,
      to: encodedTx.to,
      transfers: [transfer],
    });
  }

  // TODO memo cache
  async getEthersClient() {
    const rpcUrl = await this.getRpcUrl();
    const client = new EthersJsonRpcProvider(rpcUrl);
    return client;
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const client = await this.getEthersClient();
    const result = await client.sendTransaction(signedTx.rawTx);
    console.log('evm broadcastTransaction result: ', result);
    return {
      encodedTx: signedTx.encodedTx,
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    };
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
    if (!encodedTx) return;
    const { chainId, nonce, from, to, data, value } = encodedTx;
    return Promise.resolve({
      chainId,
      nonce,
      from,
      to,
      data,
      value,
    });
  }
}
