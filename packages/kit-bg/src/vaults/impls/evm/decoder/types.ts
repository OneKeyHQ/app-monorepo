import type { ethers } from 'ethers';

export enum EBaseEVMDecodedTxType {
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

export enum EBaseEVMDecodedTxProtocol {
  ERC20 = 'erc20',
  ERC721 = 'erc721',
  ERC1155 = 'erc1155',
}

export type IBaseEVMDecodedTx = {
  txType: EBaseEVMDecodedTxType;
  txDesc?: ethers.utils.TransactionDescription;
  protocol?: EBaseEVMDecodedTxProtocol;
};
