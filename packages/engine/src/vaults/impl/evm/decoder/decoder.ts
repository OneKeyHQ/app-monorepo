import { ethers } from '@onekeyfe/blockchain-libs';

import { Network } from '../../../../types/network';
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
  network: Network;

  fromAddress: string;
  toAddress: string;
  nonce?: number;
  txHash: string;
  is1559: boolean;
  gasLimit: number;
  gasPrice: string;
  maxPriorityFeePerGas: string;
  maxPriorityFeePerGasAmount?: string;
  maxFeePerGas: string;
  maxFeePerGasAmount?: string;
  data: string;

  gasSpend: string; // in ether, estimated gas cost
  total: string; // in ether, gasSpend + value

  contractCallInfo?: {
    contractAddress: string;
    functionName: string;
    functionSignature: string;
    args?: string[];
  };

  info: EVMDecodedItemERC20Transfer | EVMDecodedItemERC20Approve | null;
}

class EVMTxDecoder {
  private static sharedDecoder: EVMTxDecoder;

  private engine: Engine;

  private erc20Iface: ethers.utils.Interface;

  private constructor(engine: Engine) {
    this.engine = engine;
    this.erc20Iface = new ethers.utils.Interface(ABI.ERC20);
  }

  public static getDecoder(engine: Engine): EVMTxDecoder {
    if (!EVMTxDecoder.sharedDecoder) {
      EVMTxDecoder.sharedDecoder = new EVMTxDecoder(engine);
    }
    return EVMTxDecoder.sharedDecoder;
  }

  public async decode(
    rawTx: string | ethers.Transaction,
  ): Promise<EVMDecodedItem> {
    const { txType, tx, txDesc, protocol } = this.staticDecode(rawTx);
    const itemBuilder = { txType, protocol } as EVMDecodedItem;

    const networkId = `evm--${tx.chainId}`;
    const network = await this.engine.getNetwork(networkId);

    itemBuilder.network = network;
    itemBuilder.symbol = network.symbol;
    itemBuilder.amount = ethers.utils.formatEther(tx.value);
    itemBuilder.gasSpend = this.parseGasSpend(tx);
    itemBuilder.total = ethers.utils.formatEther(
      tx.value.add(ethers.utils.parseEther(itemBuilder.gasSpend)),
    );

    this.fillTxInfo(itemBuilder, tx);

    if (txDesc) {
      itemBuilder.contractCallInfo = {
        contractAddress: tx.to?.toLowerCase() ?? '',
        functionName: txDesc.name,
        functionSignature: txDesc.signature,
        args: txDesc.args.map((arg) => String(arg)),
      };
    }

    let infoBuilder:
      | EVMDecodedItemERC20Transfer
      | EVMDecodedItemERC20Approve
      | null = null;

    if (itemBuilder.protocol === 'erc20') {
      const token = await this.engine.getOrAddToken(
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

  private staticDecode(rawTx: string | ethers.Transaction): EVMBaseDecodedItem {
    const itemBuilder = {} as EVMBaseDecodedItem;

    let tx: ethers.Transaction;
    if (typeof rawTx === 'string') {
      tx = ethers.utils.parseTransaction(rawTx);
    } else {
      tx = rawTx;
    }
    itemBuilder.tx = tx;
    const { data } = tx;

    if (!data || data === '0x' || data === '0x0') {
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

  private fillTxInfo(itemBuilder: EVMDecodedItem, tx: ethers.Transaction) {
    // TODO feeDecimals hardcode
    const feeDecimals = 9;

    itemBuilder.value = tx.value.toString();
    itemBuilder.fromAddress = tx.from?.toLowerCase() ?? '';
    itemBuilder.toAddress = tx.to?.toLowerCase() ?? '';
    itemBuilder.nonce = tx.nonce;
    itemBuilder.txHash = tx.hash ?? '';
    itemBuilder.is1559 = tx.type === 2;
    itemBuilder.gasLimit = tx.gasLimit.toNumber();
    itemBuilder.gasPrice = tx.gasPrice?.toString() ?? '';
    itemBuilder.maxPriorityFeePerGas =
      tx.maxPriorityFeePerGas?.toString() ?? '';
    itemBuilder.maxFeePerGas = tx.maxFeePerGas?.toString() ?? '';
    itemBuilder.maxFeePerGasAmount =
      (itemBuilder.maxFeePerGas &&
        this.formatValue(
          ethers.BigNumber.from(itemBuilder.maxFeePerGas),
          feeDecimals,
        )) ??
      '';
    itemBuilder.maxPriorityFeePerGasAmount =
      (itemBuilder.maxPriorityFeePerGas &&
        this.formatValue(
          ethers.BigNumber.from(itemBuilder.maxPriorityFeePerGas),
          feeDecimals,
        )) ??
      '';
    itemBuilder.data = tx.data;
  }

  private formatValue(value: ethers.BigNumber, decimals: number): string {
    if (ethers.constants.MaxUint256.eq(value)) {
      return InfiniteAmountText;
    }
    return ethers.utils.formatUnits(value, decimals) ?? '';
  }

  private parseGasSpend(tx: ethers.Transaction): string {
    const { gasLimit, gasPrice, maxFeePerGas } = tx;
    const priceInWei = gasPrice || maxFeePerGas || ethers.constants.Zero;
    const gasSpendInWei = gasLimit.mul(priceInWei);
    return ethers.utils.formatEther(gasSpendInWei);
  }

  private parseERC20(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMDecodedTxType.TRANSACTION;

    try {
      txDesc = this.erc20Iface.parseTransaction(tx);
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
