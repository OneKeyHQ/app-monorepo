import type { TxStatus } from '../../../../types/covalent';
import type { Network } from '../../../../types/network';
import type { IErcNftType } from '../../../../types/nft';
import type { Token } from '../../../../types/token';
import type { ethers } from '../sdk/ethers';

enum EVMDecodedTxType {
  // Native currency transfer
  NATIVE_TRANSFER = 'native_transfer',

  // ERC20
  TOKEN_TRANSFER = 'erc20_transfer',
  TOKEN_APPROVE = 'erc20_approve',

  // ERC721
  ERC721_TRANSFER = 'erc721_transfer',

  // ERC1155
  ERC1155_TRANSFER = 'erc1155_transfer',

  // Swap
  SWAP = 'swap',
  INTERNAL_SWAP = 'internal_swap',

  INTERNAL_STAKE = 'internal_stake',

  // Generic contract interaction
  TRANSACTION = 'transaction',
}

interface EVMDecodedItemERC20Transfer {
  type: EVMDecodedTxType.TOKEN_TRANSFER;
  token: Token;
  amount: string;
  value: string;
  recipient: string;
  from?: string;
}

interface EVMDecodedItemERC20Approve {
  type: EVMDecodedTxType.TOKEN_APPROVE;
  token: Token;
  amount: string;
  value: string;
  isUInt256Max: boolean;
  spender: string;
}

interface EVMDecodedItemInternalSwap {
  type: EVMDecodedTxType.INTERNAL_SWAP;
  buyTokenAddress: string;
  sellTokenAddress: string;
  buyTokenSymbol: string;
  sellTokenSymbol: string;
  buyAmount: string;
  sellAmount: string;
}

interface EVMDecodedItemInternalStake {
  type: EVMDecodedTxType.INTERNAL_STAKE;
  token: Token;
  amount: string;
  value: string;
  recipient: string;
  from?: string;
}

interface EVMBaseDecodedItem {
  txType: EVMDecodedTxType;
  protocol?: 'erc20' | IErcNftType;
  mainSource: 'raw' | 'ethersTx' | 'covalent';
  raw?: string;

  tx: ethers.Transaction;
  txDesc?: ethers.utils.TransactionDescription;
}

interface GasInfo {
  gasLimit: number;
  gasPrice: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;

  maxPriorityFeePerGasInGwei: string;
  maxFeePerGasInGwei: string;

  maxFeeSpend: string; // in ether
  feeSpend: string; // in ether
  gasUsed: number; // actual used gas
  gasUsedRatio: number; // = (gasUsed / gasLimit)

  effectiveGasPrice: string;
  effectiveGasPriceInGwei: string;
}

type EVMDecodedInfoType =
  | EVMDecodedItemERC20Transfer
  | EVMDecodedItemERC20Approve
  | EVMDecodedItemInternalSwap
  | null;

interface EVMDecodedItem extends Omit<EVMBaseDecodedItem, 'tx' | 'txDesc'> {
  symbol: string; // native currency symbol
  amount: string; // in ether
  value: string; // in wei
  fiatAmount?: number;
  network: Network;

  fromAddress: string;
  toAddress: string;
  nonce?: number;
  txHash: string;
  blockSignedAt: number;
  data: string;
  chainId: number;
  interactWith?: string; // Dapp name or url
  fromType: 'IN' | 'OUT' | 'SELF';
  txStatus: TxStatus;
  isFinal?: boolean;

  totalFeeInNative?: string;
  total: string; // in ether, gasSpend + value
  gasInfo: GasInfo;

  contractCallInfo?: {
    contractAddress: string;
    functionName: string;
    functionSignature: string;
    args?: string[];
  };

  info: EVMDecodedInfoType;
}

export { EVMDecodedTxType };
export type {
  GasInfo,
  EVMBaseDecodedItem,
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
  EVMDecodedItemInternalStake,
  EVMDecodedInfoType,
};
