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
import {
  buildTxActionDirection,
  mergeAssetTransferActions,
} from '@onekeyhq/kit/src/utils/txAction';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import numberUtils, {
  toBigIntHex,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IAddressValidation,
  INetworkAccountAddressDetail,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { ENFTType } from '@onekeyhq/shared/types/nft';
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

import { EVMContractDecoder } from './decoder';
import {
  EErc1155MethodSelectors,
  EErc1155TxDescriptionName,
  EErc20MethodSelectors,
  EErc20TxDescriptionName,
  EErc721MethodSelectors,
  EErc721TxDescriptionName,
} from './decoder/abi';
import {
  InfiniteAmountText,
  checkIsEvmNativeTransfer,
  formatValue,
  parseToNativeTx,
} from './decoder/utils';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IApproveInfo,
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildTxHelperParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IVaultSettings,
} from '../../types';

// evm vault
export default class Vault extends VaultBase {
  override settings: IVaultSettings = settings;

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    // all evm chain shared same db account and same address, so we just validate db address only,
    // do not need recalculate address for each sub chain
    const { normalizedAddress, displayAddress } = await this.validateAddress(
      account.address,
    );
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxEvm> {
    const { transfersInfo, approveInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(params);
    }

    if (approveInfo) {
      return this._buildEncodeTxFromApprove(params);
    }
    throw new OneKeyInternalError();
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams & IBuildTxHelperParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx, getToken, getNFT } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
    const nativeTx = await parseToNativeTx({
      encodedTx,
    });

    const decoder = new EVMContractDecoder();

    let action: IDecodedTxAction | undefined = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {},
    };

    let extraNativeTransferAction: IDecodedTxAction | undefined;
    if (encodedTx.value) {
      const valueBn = new BigNumber(encodedTx.value);
      if (!valueBn.isNaN() && valueBn.gt(0)) {
        extraNativeTransferAction =
          await this._buildTxTransferNativeTokenAction({
            encodedTx,
            getNFT,
            getToken,
          });
      }
    }

    if (checkIsEvmNativeTransfer({ tx: nativeTx })) {
      action = await this._buildTxTransferNativeTokenAction({
        encodedTx,
        getNFT,
        getToken,
      });
      extraNativeTransferAction = undefined;
    }

    const erc20TxDesc = decoder.parseERC20(nativeTx);
    if (erc20TxDesc) {
      action = await this._buildTxTokenAction({
        encodedTx,
        txDesc: erc20TxDesc,
        getNFT,
        getToken,
      });
      return this._buildDecodedTx({
        encodedTx,
        action,
        extraNativeTransferAction,
      });
    }

    const erc721TxDesc = decoder.parseERC721(nativeTx);
    if (erc721TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc721TxDesc,
        getToken,
        getNFT,
      });
      return this._buildDecodedTx({
        encodedTx,
        action,
        extraNativeTransferAction,
      });
    }

    const erc1155TxDesc = decoder.parseERC1155(nativeTx);
    if (erc1155TxDesc) {
      action = await this._buildTxTransferNFTAction({
        encodedTx,
        txDesc: erc1155TxDesc,
        getToken,
        getNFT,
      });
      return this._buildDecodedTx({
        encodedTx,
        action,
        extraNativeTransferAction,
      });
    }

    return this._buildDecodedTx({
      encodedTx,
      action,
      extraNativeTransferAction,
    });
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
    const { unsignedTx, feeInfo, nonceInfo } = params;
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

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async _buildDecodedTx(params: {
    encodedTx: IEncodedTxEvm;
    action: IDecodedTxAction | undefined;
    extraNativeTransferAction: IDecodedTxAction | undefined;
  }): Promise<IDecodedTx> {
    const { encodedTx, action, extraNativeTransferAction } = params;
    const accountAddress = await this.getAccountAddress();

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: accountAddress,
      signer: encodedTx.from ?? accountAddress,
      nonce: Number(encodedTx.nonce) ?? 0,
      actions: mergeAssetTransferActions(
        [action, extraNativeTransferAction].filter(
          Boolean,
        ) as IDecodedTxAction[],
      ),
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
        if (tokenInfo.isNative || tokenInfo.address === '') {
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

    const { owner, spender, amount, tokenInfo } = approveInfo as IApproveInfo;

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const amountBN = new BigNumber(amount);
    const amountHex = toBigIntHex(
      amountBN.isNaN()
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
      nonce: String(nonceInfo.nonce),
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
    const chainIdNum = new BigNumber(chainIdHex).toNumber();

    tx.chainId = chainIdNum;
    return Promise.resolve({
      encodedTx: tx,
      nonce: Number(tx.nonce),
    });
  }

  async _buildTxTokenAction(
    params: {
      encodedTx: IEncodedTxEvm;
      txDesc: ethers.utils.TransactionDescription;
    } & IBuildTxHelperParams,
  ) {
    const { encodedTx, txDesc, getToken } = params;

    const token = await getToken({
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
    let recipient = encodedTx.to;
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
      token: token.address,
      image: token.logoURI ?? '',
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
        owner: encodedTx.from ?? accountAddress,
        spender,
        amount,
        tokenIcon: token.logoURI ?? '',
        isMax: amount === InfiniteAmountText,
      },
    };

    return action;
  }

  async _buildTxTransferNativeTokenAction(
    params: { encodedTx: IEncodedTxEvm } & IBuildTxHelperParams,
  ) {
    const { encodedTx, getToken } = params;
    const nativeToken = await getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    if (!nativeToken) return;

    const transfer: IDecodedTxTransferInfo = {
      from: encodedTx.from,
      to: encodedTx.to,
      token: nativeToken.address,
      image: nativeToken.logoURI ?? '',
      symbol: nativeToken.symbol,
      amount: new BigNumber(encodedTx.value)
        .shiftedBy(-nativeToken.decimals)
        .toFixed(),
      isNFT: false,
    };

    const action = await this._buildTxTransferAssetAction({
      from: encodedTx.from,
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
    const accountAddress = await this.getAccountAddress();

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
      } else {
        assetTransfer.receives.push(transfer);
      }
    });

    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer,
    };
  }

  async _buildTxTransferNFTAction(
    params: {
      encodedTx: IEncodedTxEvm;
      txDesc: ethers.utils.TransactionDescription;
    } & IBuildTxHelperParams,
  ) {
    const { encodedTx, txDesc, getNFT } = params;

    if (
      txDesc.name !== EErc721TxDescriptionName.SafeTransferFrom &&
      txDesc.name !== EErc1155TxDescriptionName.SafeTransferFrom
    )
      return;

    const [from, to, nftId, amount] =
      txDesc?.args.map((arg) => String(arg)) || [];

    const nft = await getNFT({
      networkId: this.networkId,
      collectionAddress: encodedTx.to,
      nftId,
    });

    if (!nft) return;

    const transfer: IDecodedTxTransferInfo = {
      from,
      to,
      token: nftId,
      amount,
      image: nft.metadata?.image ?? '',
      symbol: nft.metadata?.name ?? '',
      isNFT: true,
    };

    return this._buildTxTransferAssetAction({
      from: encodedTx.from,
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
}
