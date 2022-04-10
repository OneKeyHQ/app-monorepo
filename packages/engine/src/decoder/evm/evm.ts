import { ethers } from '@onekeyfe/blockchain-libs';

import { Engine } from '../..';
import { Token } from '../../types/token';

import { ABI } from './abi';

enum EVMTxType {
  // Native currency transfer
  NATIVE_CURRENCY_TRANSFER = 'native_transfer',

  // Contract interaction
  TRANSACTION = 'transaction',

  // ERC20
  TOKEN_TRANSFER = 'token_transfer',
  APPROVE = 'approve',
}

interface EVMBaseDecodedItem {
  txType: EVMTxType;
  tx: ethers.Transaction;
  txDesc?: ethers.utils.TransactionDescription;
}

interface EVMDecodedItemERC20Transfer {
  type: 'transfer';
  token: Token;
  amount: string;
  value: string;
  recipent: string;
}

interface EVMDecodedItemERC20Approve {
  type: 'approve';
  token: Token;
  spender: string;
  amount: string;
  value: string;
}

interface EVMDecodedItem extends EVMBaseDecodedItem {
  symbol: string; // Chain Native Currency Symbol
  amount: string; // in ether
  value: string; // in wei
  isERC20: boolean;

  from: string;
  to: string;
  hash: string;
  is1559: boolean;
  gasLimit: string;
  gasPrice: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;

  contranctCallInfo?: {
    contranctAddress: string;
    functionName: string;
    functionSignature: string;
    args: any;
  };

  info: EVMDecodedItemERC20Transfer | EVMDecodedItemERC20Approve | null;
}

class EVMTxDecoder {
  static async decode(rawTx: string, engine: Engine): Promise<EVMDecodedItem> {
    const { txType, tx, txDesc } = this.staticDecode(rawTx);
    const itemBuilder = { txType, tx, txDesc } as EVMDecodedItem;

    const networkId = `evm--${tx.chainId}`;
    itemBuilder.symbol = (await engine.getNetwork(networkId)).shortName;
    itemBuilder.amount = ethers.utils.formatEther(tx.value);
    itemBuilder.isERC20 =
      txType === EVMTxType.TOKEN_TRANSFER || txType === EVMTxType.APPROVE;

    this.fillTxInfo(itemBuilder, tx);

    if (txDesc) {
      itemBuilder.contranctCallInfo = {
        contranctAddress: tx.to ?? '',
        functionName: txDesc.name,
        functionSignature: txDesc.signature,
        args: txDesc.args,
      };
    }

    let infoBuilder:
      | EVMDecodedItemERC20Transfer
      | EVMDecodedItemERC20Approve
      | null;

    if (itemBuilder.isERC20) {
      const token = await engine.getOrAddToken(networkId, itemBuilder.to);
      if (!token) {
        // TODO: fetch token info onchain
        throw new Error(`Token ${itemBuilder.to} not found`);
      }
      switch (txType) {
        case EVMTxType.TOKEN_TRANSFER: {
          // transfer(address _to, uint256 _value)
          const recipent = txDesc?.args[0] as string;
          const value = txDesc?.args[1] as ethers.BigNumber;
          const amount = this.formatValue(value, token.decimals);
          infoBuilder = {
            type: 'transfer',
            value: value.toString(),
            amount,
            recipent,
            token,
          } as EVMDecodedItemERC20Transfer;
          break;
        }
        case EVMTxType.APPROVE: {
          // approve(address _spender, uint256 _value)
          const spender = txDesc?.args[0] as string;
          const value = txDesc?.args[1] as ethers.BigNumber;
          const amount = this.formatValue(value, token.decimals);
          infoBuilder = {
            type: 'approve',
            spender,
            amount,
            value: value.toString(),
            token,
          } as EVMDecodedItemERC20Approve;
          break;
        }
        default: {
          throw new Error(
            `EVMTxDecoder: not implemented for txType: ${txType}`,
          );
        }
      }
      itemBuilder.info = infoBuilder;
    }

    return itemBuilder;
  }

  static staticDecode(rawTx: string): EVMBaseDecodedItem {
    const itemBuilder = {} as EVMBaseDecodedItem;

    const tx = ethers.utils.parseTransaction(rawTx);
    itemBuilder.tx = tx;
    const { data } = tx;

    if (data === '0x') {
      itemBuilder.txType = EVMTxType.NATIVE_CURRENCY_TRANSFER;
      return itemBuilder;
    }

    const [erc20TxDesc, erc20TxType] = this.parseERC20(tx);
    if (erc20TxDesc) {
      itemBuilder.txDesc = erc20TxDesc;
      itemBuilder.txType = erc20TxType;
      return itemBuilder;
    }

    itemBuilder.txType = EVMTxType.TRANSACTION;
    return itemBuilder;
  }

  private static fillTxInfo(
    itemBuilder: EVMDecodedItem,
    tx: ethers.Transaction,
  ) {
    itemBuilder.value = tx.value.toString();
    itemBuilder.from = tx.from ?? '';
    itemBuilder.to = tx.to ?? '';
    itemBuilder.hash = tx.hash ?? '';
    itemBuilder.is1559 = tx.type === 2;
    itemBuilder.gasLimit = tx.gasLimit.toString();
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
      return 'Infinite';
    }
    return ethers.utils.formatUnits(value, decimals) ?? '';
  }

  private static parseERC20(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMTxType] {
    const erc20Iface = new ethers.utils.Interface(ABI.ERC20);

    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMTxType.TRANSACTION;

    try {
      txDesc = erc20Iface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }

    switch (txDesc.name) {
      case 'transfer': {
        txType = EVMTxType.TOKEN_TRANSFER;
        break;
      }
      case 'approve': {
        txType = EVMTxType.APPROVE;
        break;
      }
      default: {
        txType = EVMTxType.TRANSACTION;
      }
    }

    return [txDesc, txType];
  }
}

export { EVMTxDecoder };
