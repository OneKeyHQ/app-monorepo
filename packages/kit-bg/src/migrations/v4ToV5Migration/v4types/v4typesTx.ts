import type { IEncodedTxAda } from '@onekeyhq/core/src/chains/ada/types';
import type { IEncodedTxAlgo } from '@onekeyhq/core/src/chains/algo/types';
import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import type { IEncodedTxCfx } from '@onekeyhq/core/src/chains/cfx/types';
import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
import type { IEncodedTxCosmos } from '@onekeyhq/core/src/chains/cosmos/types';
import type { IEncodedTxDnx } from '@onekeyhq/core/src/chains/dnx/types';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IEncodedTxFil } from '@onekeyhq/core/src/chains/fil/types';
import type { IEncodedTxKaspa } from '@onekeyhq/core/src/chains/kaspa/types';
import type { IEncodedTxNear } from '@onekeyhq/core/src/chains/near/types';
import type { IEncodedTxNexa } from '@onekeyhq/core/src/chains/nexa/types';
import type { IEncodedTxNostr } from '@onekeyhq/core/src/chains/nostr/types';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
import type { IEncodedTxXrp } from '@onekeyhq/core/src/chains/xrp/types';
import type { IEmojiTypes } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IEncodedTxLightning } from '@onekeyhq/shared/types/lightning';

import type { IV4FeeInfoUnit } from './v4typesFee';
import type { IV4Token } from './v4typesToken';

type IV4SwapInfoSide = {
  networkId: string;
  // token?: string; // tokenIdOnNetwork
  tokenInfo: IV4Token;
  amount: string;
  amountValue: string;
};
type IV4SwapInfo = {
  send: IV4SwapInfoSide;
  receive: IV4SwapInfoSide;

  accountAddress: string;
  receivingAddress?: string;
  slippagePercentage: string;
  independentField: 'INPUT' | 'OUTPUT';
  swapQuote: unknown; // TODO QuoteData;
  isApprove?: boolean;
};

type IV4StakeInfo = {
  tokenInfo: IV4Token;
  amount: string;
  accountAddress: string;
};

// FeeInfo ----------------------------------------------

// TODO rename to IFeeInfoMeta

// DecodedTx ----------------------------------------------

enum EV4DecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}
export enum EV4DecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
  Removed = 'Removed',
  // for btc list order psbt
  Offline = 'Offline',
}
type IV4DecodedTxInteractInfo = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
  provider?: string;
};
type IV4UtxoAddressInfo = {
  address: string;
  balance: string;
  balanceValue: string;
  symbol: string;
  isMine: boolean;
};
enum EV4DecodedTxActionType {
  // Native currency transfer
  NATIVE_TRANSFER = 'NATIVE_TRANSFER',

  // TOKEN
  TOKEN_TRANSFER = 'TOKEN_TRANSFER',
  TOKEN_APPROVE = 'TOKEN_APPROVE',
  TOKEN_ACTIVATE = 'TOKEN_ACTIVATE',

  // NFT
  NFT_TRANSFER = 'NFT_TRANSFER',
  NFT_MINT = 'NFT_MINT',
  NFT_SALE = 'NFT_SALE',
  NFT_BURN = 'NFT_BURN',
  // Inscription
  NFT_TRANSFER_BTC = 'NFT_TRANSFER_BTC',
  NFT_INSCRIPTION = 'NFT_INSCRIPTION',

  // BRC20
  TOKEN_BRC20_TRANSFER = 'TOKEN_BRC20_TRANSFER',
  TOKEN_BRC20_DEPLOY = 'TOKEN_BRC20_DEPLOY',
  TOKEN_BRC20_MINT = 'TOKEN_BRC20_MINT',
  TOKEN_BRC20_INSCRIBE = 'TOKEN_BRC20_INSCRIBE',

  // Swap
  INTERNAL_SWAP = 'INTERNAL_SWAP',
  INTERNAL_STAKE = 'INTERNAL_STAKE',
  // SWAP = 'SWAP',

  // Contract Interaction
  FUNCTION_CALL = 'FUNCTION_CALL',

  // other
  UNKNOWN = 'UNKNOWN',
}

type IV4DecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
  // TODO rename to extraInfo
  extraInfo: unknown | null; // extra should be different in each network (eg. serialized from nativeTx actions)
};

type IV4DecodedTxActionFunctionCall = IV4DecodedTxActionBase & {
  target: string; // contractAddress
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; // approve(address, amount)
  args: unknown[];
};

type IV4DecodedTxActionNativeTransfer = IV4DecodedTxActionBase & {
  tokenInfo: IV4Token;
  utxoFrom?: IV4UtxoAddressInfo[];
  utxoTo?: IV4UtxoAddressInfo[];
  from: string;
  to: string;
  amount: string;
  amountValue: string;
  isInscribeTransfer?: boolean;
};
type IV4DecodedTxActionTokenTransfer = IV4DecodedTxActionBase & {
  tokenInfo: IV4Token;
  from: string;
  to: string;
  // recipient: string; // TODO rename to from/to
  amount: string;
  amountValue: string;
  // amountFiat: string;
};
type IV4DecodedTxActionTokenApprove = IV4DecodedTxActionBase & {
  tokenInfo: IV4Token; // TODO tokenContract / tokenIdOnNetwork
  // from: string;
  // to: string;
  owner: string;
  spender: string;
  amount: string; // TODO amount: "Infinite"
  amountValue: string;
  isMax: boolean;
};
type IV4DecodedTxActionTokenActivate = IV4DecodedTxActionBase & {
  tokenAddress: string;
  logoURI: string;
  decimals: number;
  name: string;
  symbol: string;
  networkId: string;
};
type IV4DecodedTxActionEvmInfo = {
  from: string;
  to: string;
  value: string;
  data?: string;
};
type IV4DecodedTxActionNFTBase = IV4DecodedTxActionBase & {
  asset: unknown; // TODO NFTAsset;
  send: string;
  receive: string;
  amount: string;
  from?: string;
};

type IV4DecodedTxActionNFTTrade = IV4DecodedTxActionNFTBase & {
  value?: string;
  exchangeName?: string;
  tradeSymbol?: string;
  tradeSymbolAddress?: string | null;
};

type IV4DecodedTxActionInscription = IV4DecodedTxActionBase & {
  asset: unknown; // TODO NFTBTCAssetModel;
  send: string;
  receive: string;
  isInscribeTransfer?: boolean;
  assetsInSameUtxo?: unknown[]; // TODO NFTBTCAssetModel[];
};

type IV4DecodedTxActionBRC20 = IV4DecodedTxActionBase & {
  token: IV4Token;
  sender: string;
  receiver: string;
  asset: unknown; // TODO NFTBTCAssetModel;
  assetsInSameUtxo?: unknown[]; // TODO NFTBTCAssetModel[];
  amount?: string;
  max?: string;
  limit?: string;
  isInscribeTransfer?: boolean;
};

type IV4DecodedTxActionInternalSwap = IV4DecodedTxActionBase & IV4SwapInfo;
type IV4DecodedTxActionInternalStake = IV4DecodedTxActionBase & IV4StakeInfo;
// other Unknown Action
type IV4DecodedTxActionUnknown = IV4DecodedTxActionBase;
export type IV4DecodedTxAction = {
  type: EV4DecodedTxActionType;
  direction?: EV4DecodedTxDirection; // TODO move direction to UI side generate
  hidden?: boolean;
  nativeTransfer?: IV4DecodedTxActionNativeTransfer;
  tokenTransfer?: IV4DecodedTxActionTokenTransfer;
  tokenApprove?: IV4DecodedTxActionTokenApprove;
  tokenActivate?: IV4DecodedTxActionTokenActivate;
  internalSwap?: IV4DecodedTxActionInternalSwap;
  internalStake?: IV4DecodedTxActionInternalStake;
  functionCall?: IV4DecodedTxActionFunctionCall;
  // other Unknown Action
  unknownAction?: IV4DecodedTxActionUnknown;
  evmInfo?: IV4DecodedTxActionEvmInfo;
  // nft
  nftTransfer?: IV4DecodedTxActionNFTBase;
  nftTrade?: IV4DecodedTxActionNFTTrade;
  // inscription
  inscriptionInfo?: IV4DecodedTxActionInscription;
  brc20Info?: IV4DecodedTxActionBRC20;
};

export type IV4DecodedTx = {
  txid: string; // blockHash

  owner: string; // tx belongs to both receiver and sender
  signer: string; // creator, sender, fromAddress
  // receiver: string; // receiver, toAddress

  nonce: number;
  actions: IV4DecodedTxAction[]; // inputActions
  outputActions?: IV4DecodedTxAction[];

  createdAt?: number;
  updatedAt?: number; // finishedAt, signedAt, blockSignedAt

  status: EV4DecodedTxStatus;
  // isFinalData  data wont change
  isFinal?: boolean; // tx info is full completed, like covalentTx has parsed outputActions

  networkId: string;
  accountId: string;

  feeInfo?: IV4FeeInfoUnit;
  totalFeeInNative?: string;

  interactInfo?: IV4DecodedTxInteractInfo;

  // TODO use nativeTx & decodedTx in frontend UI render
  extraInfo: unknown | null; // TODO extraInfo;
  // | IDecodedTxExtraNear
  // | IDecodedTxExtraBtc
  // | IDecodedTxExtraAlgo
  // | IDecodedTxExtraXmr
  // | null;

  encodedTx?: IV4EncodedTx;
  // used for speed up double check if encodedTx modified by some bugs
  encodedTxEncrypted?: string;
  payload?: unknown;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
};

export type IV4AvatarInfo = {
  emoji?: IEmojiTypes | 'img';
  bgColor?: string;
};

export type IV4BtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
  forceSelect?: boolean;
  confirmations?: number;
};

export type IV4CoinSelectUTXO = {
  txId: string; // TODO txId or txid?
  vout: number;
  value: number;
  address: string;
  path: string;
  forceSelect?: boolean;
};

export type IV4InputToSign = {
  index: number;
  publicKey: string;
  address: string;
  sighashTypes?: number[];
};

// EncodedTx ----------------------------------------------

// same as V5
export type IV4EncodedTxAda = IEncodedTxAda;
export type IV4EncodedTxAlgo = IEncodedTxAlgo;
export type IV4EncodedTxAptos = IEncodedTxAptos;
export type IV4EncodedTxCfx = IEncodedTxCfx;
export type IV4EncodedTxCkb = IEncodedTxCkb;
export type IV4EncodedTxCosmos = IEncodedTxCosmos;
export type IV4EncodedTxDnx = IEncodedTxDnx;
export type IV4EncodedTxDot = IEncodedTxDot;
export type IV4EncodedTxEvm = IEncodedTxEvm;
export type IV4EncodedTxFil = IEncodedTxFil;
export type IV4EncodedTxKaspa = IEncodedTxKaspa;
export type IV4EncodedTxLightning = IEncodedTxLightning;
export type IV4EncodedTxNear = IEncodedTxNear;
export type IV4EncodedTxNexa = IEncodedTxNexa;
export type IV4EncodedTxNostor = IEncodedTxNostr;
export type IV4EncodedTxSol = IEncodedTxSol;
export type IV4EncodedTxSui = IEncodedTxSui;
export type IV4EncodedTxTron = IEncodedTxTron;
export type IV4EncodedTxXrp = IEncodedTxXrp;

// not same as V5
export type IV4EncodedTxBtc = {
  inputs: IV4BtcUTXO[];
  outputs: {
    address: string;
    value: string;
    payload?: { isCharge?: boolean; bip44Path?: string; opReturn?: string };
  }[];
  feeRate: string;
  totalFee: string;
  totalFeeInNative: string;
  inputsForCoinSelect: IV4CoinSelectUTXO[];
  outputsForCoinSelect: {
    address: string;
    value?: number;
    isMax?: boolean;
    script?: string;
  }[];
  psbtHex?: string;
  inputsToSign?: IV4InputToSign[];
  isInscribeTransfer?: boolean;
};

export type IV4EncodedTx =
  | IV4EncodedTxAda
  | IV4EncodedTxAlgo
  | IV4EncodedTxAptos
  | IV4EncodedTxCfx
  | IV4EncodedTxCkb
  | IV4EncodedTxCosmos
  | IV4EncodedTxDnx
  | IV4EncodedTxDot
  | IV4EncodedTxEvm
  | IV4EncodedTxFil
  | IV4EncodedTxKaspa
  | IV4EncodedTxLightning
  | IV4EncodedTxNear
  | IV4EncodedTxNexa
  | IV4EncodedTxNostor
  | IV4EncodedTxSol
  | IV4EncodedTxSui
  | IV4EncodedTxTron
  | IV4EncodedTxXrp
  | IV4EncodedTxBtc;
