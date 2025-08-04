import type { IDecodedTxExtraAlgo } from '@onekeyhq/core/src/chains/algo/types';
import type { IDecodedTxExtraCosmos } from '@onekeyhq/core/src/chains/cosmos/types';
import type { IDecodedTxExtraDnx } from '@onekeyhq/core/src/chains/dnx/types';
import type { IDecodedTxExtraLightning } from '@onekeyhq/core/src/chains/lightning/types';
import type { IDecodedTxExtraSol } from '@onekeyhq/core/src/chains/sol/types';
import type { IDecodedTxExtraTon } from '@onekeyhq/core/src/chains/ton/types';
import type { IDecodedTxExtraTron } from '@onekeyhq/core/src/chains/tron/types';
import type { IDecodedTxExtraXrp } from '@onekeyhq/core/src/chains/xrp/types';
import type { IEncodedTx, ISignedTxPro } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import type { IFeeInfoUnit, ITronResourceRentalInfo } from './fee';
import type { EOnChainHistoryTxType } from './history';
import type { ENFTType } from './nft';
import type {
  EParseTxType,
  ISignatureConfirmDisplay,
  ITransactionData,
} from './signatureConfirm';

export enum EDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}

export enum EDecodedTxActionType {
  ASSET_TRANSFER = 'ASSET_TRANSFER',

  // Token
  TOKEN_APPROVE = 'TOKEN_APPROVE',
  TOKEN_ACTIVATE = 'TOKEN_ACTIVATE',

  // NFT
  NFT_MINT = 'NFT_MINT',
  NFT_SALE = 'NFT_SALE',
  NFT_BURN = 'NFT_BURN',

  // Swap
  INTERNAL_SWAP = 'INTERNAL_SWAP',
  INTERNAL_STAKE = 'INTERNAL_STAKE',

  // Contract Interaction
  FUNCTION_CALL = 'FUNCTION_CALL',

  // other
  UNKNOWN = 'UNKNOWN',
}
export enum EDecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
  Removed = 'Removed',
  // for btc list order psbt
  Offline = 'Offline',
}

export enum EReplaceTxType {
  SpeedUp = 'SpeedUp',
  Cancel = 'Cancel',
}

export enum EReplaceTxMethod {
  Normal = 'Normal',
  BTC_F2POOL = 'BTC_F2POOL',
  BTC_RBF = 'BTC_RBF',
}

export type ISendTxBaseParams = {
  networkId: string;
  accountId: string;
  accountAddress?: string;
  tronResourceRentalInfo?: ITronResourceRentalInfo;
};

export type IDecodedTxInteractInfo = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
  provider?: string;
};

export type IDecodedTxPayload = {
  value: string;
  label: string;
  type: EOnChainHistoryTxType;
};

export type IUtxoAddressInfo = {
  address: string;
  balance: string;
  balanceValue: string;
  symbol: string;
  isMine: boolean;
};

export type IDecodedTxExtraInfo =
  | IDecodedTxExtraAlgo
  | IDecodedTxExtraLightning
  | IDecodedTxExtraXrp
  | IDecodedTxExtraDnx
  | IDecodedTxExtraTron
  | IDecodedTxExtraSol
  | IDecodedTxExtraCosmos
  | IDecodedTxExtraTon;

export type IDecodedTx = {
  txid: string; // blockHash

  owner: string; // tx belongs to both receiver and sender
  signer: string; // creator, sender, fromAddress
  to?: string;
  isToContract?: boolean;

  nonce: number;
  actions: IDecodedTxAction[]; // inputActions
  outputActions?: IDecodedTxAction[];

  createdAt?: number;
  updatedAt?: number; // finishedAt, signedAt, blockSignedAt

  status: EDecodedTxStatus;
  // data wont change anymore
  isFinal?: boolean;

  networkId: string;
  accountId: string;
  networkLogoURI?: string;
  xpub?: string;

  feeInfo?: IFeeInfoUnit;
  approveInfo?: IApproveInfo;
  totalFeeInNative?: string;
  totalFeeFiatValue?: string;

  interactInfo?: IDecodedTxInteractInfo;

  extraInfo: null | IDecodedTxExtraInfo;

  encodedTx?: IEncodedTx;
  // used for speed up double check if encodedTx modified by some bugs
  encodedTxEncrypted?: string;
  payload?: IDecodedTxPayload;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
  nativeAmount?: string;
  nativeAmountValue?: string;
  riskyLevel?: number;

  originalTxId?: string; // for ton

  // for signature confirm page display
  txDisplay?: ISignatureConfirmDisplay;
  txParseType?: EParseTxType;
  txABI?: ITransactionData;
  isLocalParsed?: boolean;
  isConfirmationRequired?: boolean;

  isPsbt?: boolean;
  isCustomHexData?: boolean;
};

export type IDecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
  from: string;
  to: string;
  icon?: string;
};

export type IDecodedTxActionUnknown = IDecodedTxActionBase & {
  label?: string;
};

export type IDecodedTxTransferInfo = {
  from: string;
  to: string;
  amount: string;
  icon: string;
  name: string;
  symbol: string;
  tokenIdOnNetwork: string;
  isNative?: boolean;
  isNFT?: boolean;
  isOwn?: boolean; // for UTXO
  label?: string;
  price?: string;
  networkId?: string;
  NFTType?: ENFTType;
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; // approve(address, amount)
  args: any[];
};

export type IDecodedTxActionAssetTransfer = IDecodedTxActionBase & {
  sends: IDecodedTxTransferInfo[];
  receives: IDecodedTxTransferInfo[];
  utxoFrom?: IUtxoAddressInfo[];
  utxoTo?: IUtxoAddressInfo[];
  label?: string;
  application?: {
    name: string;
    icon: string;
  };
  internalStakingLabel?: string;
  isInternalStaking?: boolean;
  isInternalSwap?: boolean;
  swapReceivedAddress?: string;
  swapReceivedNetworkId?: string;
};

export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  amount: string;
  symbol: string;
  name: string;
  decimals: number;
  spender: string;
  isInfiniteAmount: boolean;
  tokenIdOnNetwork: string;
  label?: string;
};

export type IDecodedTxActionTokenActivate = IDecodedTxActionBase & {
  decimals: number;
  name: string;
  symbol: string;
  tokenIdOnNetwork: string;
};

export type IDecodedTxAction = {
  type: EDecodedTxActionType;
  direction?: EDecodedTxDirection;
  hidden?: boolean;
  data?: string;
  assetTransfer?: IDecodedTxActionAssetTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  tokenActivate?: IDecodedTxActionTokenActivate;

  functionCall?: IDecodedTxActionFunctionCall;

  unknownAction?: IDecodedTxActionUnknown;
};

export type ISendTxOnSuccessData = {
  signedTx: ISignedTxPro;
  decodedTx: IDecodedTx;
  feeInfo?: IFeeInfoUnit;
  approveInfo?: IApproveInfo;
};

export type IReplaceTxInfo = {
  replaceType: EReplaceTxType;
  replaceHistoryId: string;
};

export enum EBtcF2poolReplaceState {
  NOT_ACCELERATED = 0,
  ACCELERATED_PENDING = 1,
  ACCELERATED_CONFIRMED = 2,
}
