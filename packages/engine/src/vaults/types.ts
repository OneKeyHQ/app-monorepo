import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type { SendConfirmActionType } from '@onekeyhq/kit/src/views/Send/types';
import type { QuoteData } from '@onekeyhq/kit/src/views/Swap/typings';
import type { InputToSign } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.types';

import type { Engine } from '../index';
import type { AccountCredential } from '../types/account';
import type { BulkTypeEnum } from '../types/batchTransfer';
import type { AccountNameInfo, EIP1559Fee } from '../types/network';
import type {
  IErcNftType,
  INFTAsset,
  NFTAsset,
  NFTBTCAssetModel,
} from '../types/nft';
import type { Token } from '../types/token';
import type {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';
import type { IEncodedTxADA } from './impl/ada/types';
import type {
  IDecodedTxExtraAlgo,
  IEncodedTxAlgo,
  IEncodedTxGroupAlgo,
} from './impl/algo/types';
import type { IEncodedTxAptos } from './impl/apt/types';
import type {
  IDecodedTxExtraBtc,
  IEncodedTxBtc,
  INativeTxBtc,
} from './impl/btc/types';
import type { IEncodedTxCfx } from './impl/cfx/types';
import type { IEncodedTxCosmos } from './impl/cosmos/type';
import type { IEncodedTxDot } from './impl/dot/types';
import type { IEncodedTxDynex } from './impl/dynex/types';
import type { EVMDecodedItem } from './impl/evm/decoder/types';
import type { INativeTxEvm } from './impl/evm/types';
import type { IEncodedTxEvm } from './impl/evm/Vault';
import type { IEncodedTxFil } from './impl/fil/types';
import type { IEncodedTxKaspa } from './impl/kaspa/types';
import type { IEncodedTxLightning } from './impl/lightning-network/types';
import type { LNURLPaymentInfo } from './impl/lightning-network/types/lnurl';
import type {
  IDecodedTxExtraNear,
  IEncodedTxNear,
  INativeTxNear,
} from './impl/near/types';
import type { IEncodedTxNervos } from './impl/nervos/types/IEncodedTx';
import type { IEncodedTxNexa } from './impl/nexa/types';
import type { IEncodedTxNostr } from './impl/nostr/helper/types';
import type { IEncodedTxSol, INativeTxSol } from './impl/sol/types';
import type { IEncodedTxSTC } from './impl/stc/types';
import type { IEncodedTxSUI } from './impl/sui/types';
import type { IEncodedTxTron } from './impl/tron/types';
import type { IDecodedTxExtraXmr, IEncodedTxXmr } from './impl/xmr/types';
import type { IEncodedTxXrp } from './impl/xrp/types';
import type { ICoinSelectAlgorithm } from './utils/btcForkChain/utils';

// Options ----------------------------------------------
export type IVaultSubNetworkSettings = {
  isIntegerGasPrice?: boolean;
  minGasPrice?: string;
  allowZeroFee?: boolean;
};

export type TxExtraInfo = {
  key: string;
  title: LocaleIds;
  canCopy?: boolean;
  isShorten?: boolean;
  numberOfLines?: number;
};

export type IVaultSettings = {
  accountNameInfo: Record<string, AccountNameInfo>;
  feeInfoEditable: boolean;
  privateKeyExportEnabled: boolean;
  publicKeyExportEnabled?: boolean;
  tokenEnabled: boolean;
  txCanBeReplaced: boolean;

  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  externalAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;

  softwareAccountDisabled?: boolean;

  addressDerivationDisabled?: boolean;
  validationRequired?: boolean;
  disabledInExtension?: boolean;
  disabledInExtensionManifestV3?: boolean;
  exportCredentialInfo?: AccountCredential[];
  txExtraInfo?: TxExtraInfo[];
  enabledInDevModeOnly?: boolean;
  showPendingTxsWarning?: boolean;

  minTransferAmount?: string;
  allowZeroFee?: boolean;
  dust?: string;

  isUTXOModel: boolean;
  isFeeRateMode?: boolean;

  activateAccountRequired?: boolean;
  activateTokenRequired?: boolean;

  minGasLimit?: number;
  maxGasLimit?: number;
  minGasPrice?: string;

  cannotSendToSelf?: boolean;

  displayChars?: number;
  /**
   * Deposit in account.
   * e.g. Polkadot https://wiki.polkadot.network/docs/build-protocol-info#existential-deposit
   */
  existDeposit?: boolean;

  /**
   * xrp destination tag
   * cosmos memo
   * https://xrpl.org/source-and-destination-tags.html
   * https://support.ledger.com/hc/en-us/articles/4409603715217-What-is-a-Memo-Tag-?support=true
   */
  withDestinationTag?: boolean;

  // dynex payment id
  withPaymentId?: boolean;

  subNetworkSettings?: {
    [networkId: string]: IVaultSubNetworkSettings;
  };

  supportFilterScam?: boolean;

  supportBatchTransfer?: BulkTypeEnum[];
  nativeSupportBatchTransfer?: boolean;
  batchTransferApprovalRequired?: boolean;
  batchTransferApprovalConfirmRequired?: boolean;
  maxActionsInTx?: number;

  hardwareMaxActionsEnabled?: boolean;
  transactionIdPattern?: string;
  isBtcForkChain?: boolean;
  nonceEditable?: boolean;
  signOnlyReturnFullTx?: boolean;
  sendNFTEnable?: boolean;

  hiddenNFTTab?: boolean;
  hiddenToolTab?: boolean;
  hiddenAddress?: boolean;
  hiddenAccountInfoMoreOption?: boolean;
  customAccountInfoSwapOption?: boolean;
  displayMemo?: boolean;
  hideFromToFieldIfValueEmpty?: boolean;
  hideFeeSpeedInfo?: boolean;
  rpcStatusDisabled?: boolean;
  useSimpleTipForSpecialCheckEncodedTx?: boolean;
  hexDataEditable?: boolean;

  hiddenBlockBrowserTokenDetailLink?: boolean;

  hideInAllNetworksMode?: boolean;
  mnemonicAsPrivatekey?: boolean;
};
export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
  walletId?: string;
};
export type IVaultOptions = IVaultFactoryOptions & {
  engine: Engine;
};
export type ISignCredentialOptions = {
  password?: string;
};

// Internal txInfo ----------------------------------------------
export type ITransferInfoNftInscription = {
  // BTC NFT inscription
  inscriptionId: string;
  address: string;
  output: string;
  location: string;
};
export type ITransferInfo = {
  from: string;
  to: string;
  amount: string;
  token?: string; // tokenIdOnNetwork
  tokenSendAddress?: string; // for sol
  isNFT?: boolean;
  isBRC20?: boolean;
  isInscribe?: boolean;
  nftTokenId?: string; // NFT token id, btc utxo txid & vout
  nftType?: IErcNftType; // NFT standard: erc721/erc1155
  nftInscription?: ITransferInfoNftInscription;
  destinationTag?: string; // Ripple chain destination tag, Cosmos chain memo
  keepAlive?: boolean; // Polkadot chain keep alive
  selectedUtxos?: string[]; // coin control
  coinControlDisabled?: boolean;
  coinSelectAlgorithm?: ICoinSelectAlgorithm;
  lnurlPaymentInfo?: LNURLPaymentInfo;
  lightningAddress?: string;
  txInterval?: string;
  ignoreInscriptions?: boolean;
  useCustomAddressesBalance?: boolean;
  opReturn?: string;
  paymentId?: string; // dynex payment id
};
export type IApproveInfo = {
  from: string; // token owner
  token: string; // token address
  amount: string; // amount
  spender: string; // spender to authorize
};
export type ISetApprovalForAll = {
  from: string; // token owner
  to: string;
  approved: boolean; // is approved
  spender: string; // spender to authorize
  type?: string;
};
export type IERC721Approve = {
  from: string; // token owner
  to: string;
  approve: string; // approve address
  tokenId: string; // tokenId
};
export type ISwapInfoSide = {
  networkId: string;
  // token?: string; // tokenIdOnNetwork
  tokenInfo: Token;
  amount: string;
  amountValue: string;
};
export type ISwapInfo = {
  send: ISwapInfoSide;
  receive: ISwapInfoSide;

  accountAddress: string;
  receivingAddress?: string;
  slippagePercentage: string;
  independentField: 'INPUT' | 'OUTPUT';
  swapQuote: QuoteData;
  isApprove?: boolean;
};

export type IStakeInfo = {
  tokenInfo: Token;
  amount: string;
  accountAddress: string;
};

export type INFTInfo = {
  asset: INFTAsset;
  amount: string;
  from: string;
  to: string;
};

// EncodedTx\RawTx\SignedTx ----------------------------------------------
export type IEncodedTx =
  | IEncodedTxEvm
  | IEncodedTxNear
  | IEncodedTxBtc
  | IEncodedTxSTC
  | IEncodedTxSol
  | IEncodedTxTron
  | IEncodedTxAptos
  | IEncodedTxCfx
  | IEncodedTxAlgo
  | IEncodedTxGroupAlgo
  | IEncodedTxXrp
  | IEncodedTxCosmos
  | IEncodedTxADA
  | IEncodedTxSUI
  | IEncodedTxFil
  | IEncodedTxDot
  | IEncodedTxXmr
  | IEncodedTxKaspa
  | IEncodedTxNexa
  | IEncodedTxLightning
  | IEncodedTxNostr
  | IEncodedTxNervos
  | IEncodedTxDynex;

export type INativeTx =
  | INativeTxEvm
  | INativeTxNear
  | INativeTxBtc
  | INativeTxSol;
export type IRawTx = string;
export type IUnsignedTxPro = UnsignedTx & {
  encodedTx: IEncodedTx;
  psbtHex?: string;
  inputsToSign?: InputToSign[];
  // signerAccount: ISignerAccountEvm | ISignerAccountNear | ISignerAccountAptos
};
export type ISignedTxPro = {
  encodedTx?: IEncodedTx;
} & SignedTxResult;

export type SignedTxResult = {
  signatureScheme?: CurveName;
  signature?: string; // hex string
  publicKey?: string; // hex string
  digest?: string; // hex string
  txKey?: string; // hex string for Monero
  pendingTx?: boolean; // It is used for Aptos to wait for the chain to get the transaction state
  // for lightning network
  nonce?: number;
  randomSeed?: number;
} & SignedTx;

// EncodedTx Update ----------------------------------------------
export enum IEncodedTxUpdateType {
  transfer = 'transfer',
  tokenApprove = 'tokenApprove',
  speedUp = 'speedUp',
  cancel = 'cancel',
  advancedSettings = 'advancedSettings',
  customData = 'customData',
  prioritizationFee = 'prioritizationFee',
}

export type IEncodedTxUpdateOptions = {
  type?: IEncodedTxUpdateType;
};
export type IEncodedTxUpdatePayloadTokenApprove = {
  amount: string;
};
export type IEncodedTxUpdatePayloadTransfer = {
  amount: string;
  totalBalance?: string;
  feeInfo?: IFeeInfo;
};

// FeeInfo ----------------------------------------------
export type IFeeInfoPrice = string | EIP1559Fee; // in GWEI
// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IFeeInfoUnit = {
  eip1559?: boolean;
  priceValue?: string;
  price?: string; // in GWEI
  price1559?: EIP1559Fee;
  limit?: string;
  limitForDisplay?: string;
  limitUsed?: string;
  similarToPreset?: string;
  waitingSeconds?: number;
  isBtcForkChain?: boolean;
  btcFee?: number;
  feeRate?: string;
  // sol prioritization fees
  computeUnitPrice?: string;
  isSolChain?: boolean;
};
// TODO rename to IFeeInfoMeta
export type IFeeInfo = {
  // TODO merge (limit, prices, EIP1559Fee) to single field
  limit?: string; // calculated gasLimit of encodedTx
  limitForDisplay?: string;
  prices: Array<IFeeInfoPrice>; // preset gasPrices: normal, fast, rapid
  defaultPresetIndex: string; // '0' | '1' | '2';
  waitingSeconds?: Array<number>; // waiting time for different prices
  disableEditFee?: boolean; // disable fee edit

  feeSymbol?: string; // feeSymbol: GWEI
  feeDecimals?: number; // feeDecimals: 9
  nativeSymbol?: string; // ETH
  nativeDecimals?: number; // 18

  // TODO rename to feeInTx
  tx?: IFeeInfoUnit | null;
  eip1559?: boolean;
  customDisabled?: boolean;
  baseFeeValue?: string; // A base fee: e.g. L1 fee for Layer 2 networks
  extraInfo?: {
    tokensChangedTo?: { [key: string]: string | undefined };
    networkCongestion?: number;
    estimatedTransactionCount?: number;
    originalPrices?: Array<EIP1559Fee | string> | null;
  } | null;
  isBtcForkChain?: boolean;
  feeList?: number[];
  // for sol prioritization fees
  isSolChain?: boolean;
  computeUnitPrice?: string;
};
export type IFeeInfoSelectedType = 'preset' | 'custom';
export type IFeeInfoSelected = {
  type: IFeeInfoSelectedType;
  preset: string; // '0' | '1' | '2';
  custom?: IFeeInfoUnit;
};
export type IFeeInfoPayload = {
  selected: IFeeInfoSelected;
  info: IFeeInfo;
  current: {
    total: string; // total fee in Gwei
    totalNative: string; // total fee in ETH
    totalForDisplay?: string;
    totalNativeForDisplay?: string;
    value: IFeeInfoUnit;
    // as an estimated min fee for unapproved batch transfer
    minTotal?: string;
    minTotalNative?: string;
  };
  extraInfo?: any | null;
};

// PrepareAccounts ----------------------------------------------
export type IPrepareWatchingAccountsParams = {
  target: string;
  name: string;
  accountIdPrefix: typeof WALLET_TYPE_WATCHING | typeof WALLET_TYPE_EXTERNAL;
  template?: string;
};
export type IPrepareImportedAccountsParams = {
  privateKey: Buffer;
  name: string;
  template?: string;
};
export type IPrepareSoftwareAccountsParams = {
  password: string;
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
  coinType: string;
  template: string;
  skipCheckAccountExist?: boolean;
};
export type IPrepareHardwareAccountsParams = {
  type: 'SEARCH_ACCOUNTS' | 'ADD_ACCOUNTS';
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
  coinType: string;
  template: string;
  skipCheckAccountExist?: boolean;
  confirmOnDevice?: boolean;
};
export type IPrepareAccountsParams =
  | IPrepareWatchingAccountsParams
  | IPrepareImportedAccountsParams
  | IPrepareSoftwareAccountsParams
  | IPrepareHardwareAccountsParams;

// GetAddress ----------------------------------------------
export type IHardwareGetAddressParams = {
  path: string;
  showOnOneKey: boolean;
  /**
   * for btc like chain, wheh isTemplatePath is true, param path is whole path
   * e.g., isTemplatePath = false, then the path is m/44'/0'/0'
   *       isTemplatePath = true, then the path is m/44'/0'/0'/0/0
   */
  isTemplatePath?: boolean;
};

export type IGetAddressParams = IHardwareGetAddressParams;

// PrepareAccountByAddressIndex
export type IPrepareAccountByAddressIndexParams = {
  password: string;
  template: string;
  accountIndex: number;
  addressIndex: number;
};

// DecodedTx ----------------------------------------------
export type IDecodedTxLegacy = EVMDecodedItem;

export enum IDecodedTxDirection {
  IN = 'IN', // received
  OUT = 'OUT', // sent
  SELF = 'SELF', // sent to self
  OTHER = 'OTHER',
}
export enum IDecodedTxStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Dropped = 'Dropped',
  Removed = 'Removed',
  // for btc list order psbt
  Offline = 'Offline',
}
export type IDecodedTxInteractInfo = {
  // Dapp info
  name: string;
  url: string;
  description: string;
  icons: string[];
  provider?: string;
};
export type IUtxoAddressInfo = {
  address: string;
  balance: string;
  balanceValue: string;
  symbol: string;
  isMine: boolean;
};
export enum IDecodedTxActionType {
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

export type IDecodedTxActionBase = {
  nativeAmount?: string;
  nativeAmountValue?: string;
  // TODO rename to extraInfo
  extraInfo: any | null; // extra should be different in each network (eg. serialized from nativeTx actions)
};

export type IDecodedTxActionFunctionCall = IDecodedTxActionBase & {
  target: string; // contractAddress
  functionName: string; // approve
  functionHash?: string; // 0x095ea7b3
  functionSignature?: string; // approve(address, amount)
  args: any[];
};

export type IDecodedTxActionNativeTransfer = IDecodedTxActionBase & {
  tokenInfo: Token;
  utxoFrom?: IUtxoAddressInfo[];
  utxoTo?: IUtxoAddressInfo[];
  from: string;
  to: string;
  amount: string;
  amountValue: string;
  isInscribeTransfer?: boolean;
};
export type IDecodedTxActionTokenTransfer = IDecodedTxActionBase & {
  tokenInfo: Token;
  from: string;
  to: string;
  // recipient: string; // TODO rename to from/to
  amount: string;
  amountValue: string;
  // amountFiat: string;
};
export type IDecodedTxActionTokenApprove = IDecodedTxActionBase & {
  tokenInfo: Token; // TODO tokenContract / tokenIdOnNetwork
  // from: string;
  // to: string;
  owner: string;
  spender: string;
  amount: string; // TODO amount: "Infinite"
  amountValue: string;
  isMax: boolean;
};
export type IDecodedTxActionTokenActivate = IDecodedTxActionBase & {
  tokenAddress: string;
  logoURI: string;
  decimals: number;
  name: string;
  symbol: string;
  networkId: string;
};
export type IDecodedTxActionEvmInfo = {
  from: string;
  to: string;
  value: string;
  data?: string;
};
export type IDecodedTxActionNFTBase = IDecodedTxActionBase & {
  asset: NFTAsset;
  send: string;
  receive: string;
  amount: string;
  from?: string;
};

export type IDecodedTxActionNFTTrade = IDecodedTxActionNFTBase & {
  value?: string;
  exchangeName?: string;
  tradeSymbol?: string;
  tradeSymbolAddress?: string | null;
};

export type IDecodedTxActionInscription = IDecodedTxActionBase & {
  asset: NFTBTCAssetModel;
  send: string;
  receive: string;
  isInscribeTransfer?: boolean;
  assetsInSameUtxo?: NFTBTCAssetModel[];
};

export type IDecodedTxActionBRC20 = IDecodedTxActionBase & {
  token: Token;
  sender: string;
  receiver: string;
  asset: NFTBTCAssetModel;
  assetsInSameUtxo?: NFTBTCAssetModel[];
  amount?: string;
  max?: string;
  limit?: string;
  isInscribeTransfer?: boolean;
};

export type IDecodedTxActionInternalSwap = IDecodedTxActionBase & ISwapInfo;
export type IDecodedTxActionInternalStake = IDecodedTxActionBase & IStakeInfo;
// other Unknown Action
export type IDecodedTxActionUnknown = IDecodedTxActionBase;
export type IDecodedTxAction = {
  type: IDecodedTxActionType;
  direction?: IDecodedTxDirection; // TODO move direction to UI side generate
  hidden?: boolean;
  nativeTransfer?: IDecodedTxActionNativeTransfer;
  tokenTransfer?: IDecodedTxActionTokenTransfer;
  tokenApprove?: IDecodedTxActionTokenApprove;
  tokenActivate?: IDecodedTxActionTokenActivate;
  internalSwap?: IDecodedTxActionInternalSwap;
  internalStake?: IDecodedTxActionInternalStake;
  functionCall?: IDecodedTxActionFunctionCall;
  // other Unknown Action
  unknownAction?: IDecodedTxActionUnknown;
  evmInfo?: IDecodedTxActionEvmInfo;
  // nft
  nftTransfer?: IDecodedTxActionNFTBase;
  nftTrade?: IDecodedTxActionNFTTrade;
  // inscription
  inscriptionInfo?: IDecodedTxActionInscription;
  brc20Info?: IDecodedTxActionBRC20;
};

export type IDecodedTx = {
  txid: string; // blockHash

  owner: string; // tx belongs to both receiver and sender
  signer: string; // creator, sender, fromAddress
  // receiver: string; // receiver, toAddress

  nonce: number;
  actions: IDecodedTxAction[]; // inputActions
  outputActions?: IDecodedTxAction[];

  createdAt?: number;
  updatedAt?: number; // finishedAt, signedAt, blockSignedAt

  status: IDecodedTxStatus;
  // isFinalData  data wont change anymore
  isFinal?: boolean; // tx info is full completed, like covalentTx has parsed outputActions

  networkId: string;
  accountId: string;

  feeInfo?: IFeeInfoUnit;
  totalFeeInNative?: string;

  interactInfo?: IDecodedTxInteractInfo;

  // TODO use nativeTx & decodedTx in frontend UI render
  extraInfo:
    | IDecodedTxExtraNear
    | IDecodedTxExtraBtc
    | IDecodedTxExtraAlgo
    | IDecodedTxExtraXmr
    | null;

  encodedTx?: IEncodedTx;
  // used for speed up double check if encodedTx modified by some bugs
  encodedTxEncrypted?: string;
  payload?: any;

  tokenIdOnNetwork?: string; // indicates this tx belongs to which token
};

// History ----------------------------------------------
export type IHistoryTx = {
  id: string; // historyId

  isLocalCreated?: boolean;

  replacedPrevId?: string; // cancel speedUp replacedId
  replacedNextId?: string;
  replacedType?: SendConfirmActionType; // cancel speedUp

  decodedTx: IDecodedTx;
};

export type IClientEndpointStatus = {
  responseTime: number;
  latestBlock: number;
  rpcBatchSupported?: boolean;
};

export type IBalanceDetails = {
  errorMessageKey?: LocaleIds;

  total: string;
  available: string;
  unavailable: string;

  unavailableOfLocalFrozen?: string;
  unavailableOfUnconfirmed?: string;
  unavailableOfInscription?: string; // BTC Inscription value
  unavailableOfUnchecked?: string; // BTC not verified value by ordinals
};
