import { isString } from 'lodash';

import { ethers } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';

import { ABI } from './abi';
import { EBaseEVMDecodedTxProtocol, EBaseEVMDecodedTxType } from './types';
import { checkIsEvmNativeTransfer } from './utils';

import type { IBaseEVMDecodedTx } from './types';

class EVMTxDecoder {
  private erc20Interface: ethers.utils.Interface;

  private erc721Interface: ethers.utils.Interface;

  private erc1155Interface: ethers.utils.Interface;

  private batchTransferInterface: ethers.utils.Interface;

  constructor() {
    this.erc20Interface = new ethers.utils.Interface(ABI.ERC20);
    this.erc721Interface = new ethers.utils.Interface(ABI.ERC721);
    this.erc1155Interface = new ethers.utils.Interface(ABI.ERC1155);
    this.batchTransferInterface = new ethers.utils.Interface(
      ABI.BATCH_TRANSFER,
    );
  }

  public parseTx({ rawTx }: { rawTx: string | ethers.Transaction }) {
    let tx = rawTx;
    const baseDecodedTx = {} as IBaseEVMDecodedTx;
    if (isString(tx)) {
      tx = ethers.utils.parseTransaction(tx);
    }

    if (checkIsEvmNativeTransfer({ tx })) {
      baseDecodedTx.txType = EBaseEVMDecodedTxType.NATIVE_TRANSFER;
      return baseDecodedTx;
    }

    const [erc20TxDesc, erc20TxType] = this.parseERC20(tx);
    if (erc20TxDesc) {
      baseDecodedTx.protocol = EBaseEVMDecodedTxProtocol.ERC20;
      baseDecodedTx.txDesc = erc20TxDesc;
      baseDecodedTx.txType = erc20TxType;
      return baseDecodedTx;
    }

    const [erc1155TxDesc, erc1155TxType] = this.parseERC1155(tx);
    if (erc1155TxDesc) {
      baseDecodedTx.protocol = EBaseEVMDecodedTxProtocol.ERC1155;
      baseDecodedTx.txDesc = erc1155TxDesc;
      baseDecodedTx.txType = erc1155TxType;
      return baseDecodedTx;
    }

    const [erc721TxDesc, erc721TxType] = this.parseERC721(tx);
    if (erc721TxDesc) {
      baseDecodedTx.protocol = EBaseEVMDecodedTxProtocol.ERC721;
      baseDecodedTx.txDesc = erc721TxDesc;
      baseDecodedTx.txType = erc721TxType;
      return baseDecodedTx;
    }

    baseDecodedTx.txType = EBaseEVMDecodedTxType.TRANSACTION;
    return baseDecodedTx;
  }

  private parseERC20(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EBaseEVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EBaseEVMDecodedTxType.TRANSACTION;

    try {
      txDesc = this.erc20Interface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }

    switch (txDesc.name) {
      case 'transfer': {
        txType = EBaseEVMDecodedTxType.TOKEN_TRANSFER;
        break;
      }
      case 'transferFrom': {
        txType = EBaseEVMDecodedTxType.TOKEN_TRANSFER;
        break;
      }
      case 'approve': {
        txType = EBaseEVMDecodedTxType.TOKEN_APPROVE;
        break;
      }
      default: {
        txType = EBaseEVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  private parseERC721(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EBaseEVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EBaseEVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.erc721Interface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    switch (txDesc.name) {
      case 'safeTransferFrom': {
        txType = EBaseEVMDecodedTxType.ERC721_TRANSFER;
        break;
      }
      default: {
        txType = EBaseEVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  private parseERC1155(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EBaseEVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EBaseEVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.erc1155Interface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    switch (txDesc.name) {
      case 'safeTransferFrom': {
        txType = EBaseEVMDecodedTxType.ERC1155_TRANSFER;
        break;
      }
      default: {
        txType = EBaseEVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  public parseBatchTransfer(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EBaseEVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    const txType = EBaseEVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.batchTransferInterface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    return [txDesc, txType];
  }
}

export { EVMTxDecoder, EBaseEVMDecodedTxType };
