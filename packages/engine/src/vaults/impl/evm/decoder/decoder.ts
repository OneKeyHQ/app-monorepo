import { ethers } from '@onekeyfe/blockchain-libs';

import { Token } from '../../../../types/token';

import { ABI } from './abi';

import type { Engine } from '../../../..';

export const InfiniteAmountText = 'Infinite';
export const InfiniteAmountHex =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

enum EVMDecodedTxType {
  // Native currency transfer
  NATIVE_TRANSFER = 'native_transfer',

  // ERC20
  TOKEN_TRANSFER = 'erc20_transfer',
  TOKEN_APPROVE = 'erc20_approve',

  // ERC721 NFT
  ERC721_TRANSFER = 'erc721_transfer',

  // Swap
  SWAP = 'swap',

  // Generic contract interaction
  TRANSACTION = 'transaction',
}

interface EVMBaseDecodedItem {
  txType: EVMDecodedTxType;
  protocol?: 'erc20' | 'erc721';

  tx: ethers.Transaction;
  txDesc?: ethers.utils.TransactionDescription;
}

interface EVMDecodedItemERC20Transfer {
  type: EVMDecodedTxType.TOKEN_TRANSFER;
  token: Token;
  amount: string;
  value: string;
  recipient: string;
}

interface EVMDecodedItemERC20Approve {
  type: EVMDecodedTxType.TOKEN_APPROVE;
  token: Token;
  amount: string;
  value: string;
  spender: string;
}

interface EVMDecodedItem {
  txType: EVMDecodedTxType;
  protocol: 'erc20' | null;

  symbol: string; // native currency symbol
  amount: string; // in ether
  value: string; // in wei

  fromAddress: string;
  toAddress: string;
  txHash: string;
  is1559: boolean;
  gasLimit: number;
  gasPrice: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;

  contractCallInfo?: {
    contractAddress: string;
    functionName: string;
    functionSignature: string;
    args?: any;
  };

  info: EVMDecodedItemERC20Transfer | EVMDecodedItemERC20Approve | null;
}

class EVMTxDecoder {
  static async decode(
    rawTx: string | ethers.Transaction,
    engine: Engine,
  ): Promise<EVMDecodedItem> {
    const { txType, tx, txDesc, protocol } = this.staticDecode(rawTx);
    const itemBuilder = { txType, protocol } as EVMDecodedItem;

    const networkId = `evm--${tx.chainId}`;
    itemBuilder.symbol = (await engine.getNetwork(networkId)).symbol;
    itemBuilder.amount = ethers.utils.formatEther(tx.value);

    this.fillTxInfo(itemBuilder, tx);

    if (txDesc) {
      itemBuilder.contractCallInfo = {
        contractAddress: tx.to?.toLowerCase() ?? '',
        functionName: txDesc.name,
        functionSignature: txDesc.signature,
        // TODO args not serializable
        args: txDesc.args,
      };
    }

    let infoBuilder:
      | EVMDecodedItemERC20Transfer
      | EVMDecodedItemERC20Approve
      | null = null;

    if (itemBuilder.protocol === 'erc20') {
      const token = await engine.getOrAddToken(
        networkId,
        itemBuilder.toAddress,
      );
      if (!token) {
        throw new Error(`Token ${itemBuilder.toAddress} not found`);
      }
      switch (txType) {
        case EVMDecodedTxType.TOKEN_TRANSFER: {
          // transfer(address _to, uint256 _value)
          const recipient = (txDesc?.args[0] as string).toLowerCase();
          const value = txDesc?.args[1] as ethers.BigNumber;
          const amount = this.formatValue(value, token.decimals);
          infoBuilder = {
            type: EVMDecodedTxType.TOKEN_TRANSFER,
            value: value.toString(),
            amount,
            recipient,
            token,
          } as EVMDecodedItemERC20Transfer;
          break;
        }
        case EVMDecodedTxType.TOKEN_APPROVE: {
          // approve(address _spender, uint256 _value)
          const spender = (txDesc?.args[0] as string).toLowerCase();
          const value = txDesc?.args[1] as ethers.BigNumber;
          const amount = this.formatValue(value, token.decimals);
          infoBuilder = {
            type: EVMDecodedTxType.TOKEN_APPROVE,
            spender,
            amount,
            value: value.toString(),
            token,
          } as EVMDecodedItemERC20Approve;
          break;
        }
        default: {
          // TODO: handle others erc20 tx
          break;
        }
      }
      itemBuilder.info = infoBuilder;
    }

    return itemBuilder;
  }

  private static staticDecode(
    rawTx: string | ethers.Transaction,
  ): EVMBaseDecodedItem {
    const itemBuilder = {} as EVMBaseDecodedItem;

    let tx: ethers.Transaction;
    if (typeof rawTx === 'string') {
      tx = ethers.utils.parseTransaction(rawTx);
    } else {
      tx = rawTx;
    }
    itemBuilder.tx = tx;
    const { data } = tx;

    if (data === '0x') {
      itemBuilder.txType = EVMDecodedTxType.NATIVE_TRANSFER;
      return itemBuilder;
    }

    const [erc20TxDesc, erc20TxType] = this.parseERC20(tx);
    if (erc20TxDesc) {
      itemBuilder.protocol = 'erc20';
      itemBuilder.txDesc = erc20TxDesc;
      itemBuilder.txType = erc20TxType;
      return itemBuilder;
    }

    itemBuilder.txType = EVMDecodedTxType.TRANSACTION;
    return itemBuilder;
  }

  private static fillTxInfo(
    itemBuilder: EVMDecodedItem,
    tx: ethers.Transaction,
  ) {
    itemBuilder.value = tx.value.toString();
    itemBuilder.fromAddress = tx.from?.toLowerCase() ?? '';
    itemBuilder.toAddress = tx.to?.toLowerCase() ?? '';
    itemBuilder.txHash = tx.hash ?? '';
    itemBuilder.is1559 = tx.type === 2;
    itemBuilder.gasLimit = tx.gasLimit.toNumber();
    itemBuilder.gasPrice = tx.gasPrice?.toString() ?? '';
    itemBuilder.maxPriorityFeePerGas =
      tx.maxPriorityFeePerGas?.toString() ?? '';
    itemBuilder.maxFeePerGas = tx.maxFeePerGas?.toString() ?? '';
  }

  private static formatValue(
    value: ethers.BigNumber,
    decimals: number,
  ): string {
    if (ethers.constants.MaxUint256.eq(value)) {
      return InfiniteAmountText;
    }
    return ethers.utils.formatUnits(value, decimals) ?? '';
  }

  private static parseERC20(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    const erc20Iface = new ethers.utils.Interface(ABI.ERC20);

    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMDecodedTxType.TRANSACTION;

    try {
      txDesc = erc20Iface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }

    switch (txDesc.name) {
      case 'transfer': {
        txType = EVMDecodedTxType.TOKEN_TRANSFER;
        break;
      }
      case 'approve': {
        txType = EVMDecodedTxType.TOKEN_APPROVE;
        break;
      }
      default: {
        txType = EVMDecodedTxType.TRANSACTION;
      }
    }

    return [txDesc, txType];
  }
}

export { EVMTxDecoder, EVMDecodedTxType };
export type {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
};
