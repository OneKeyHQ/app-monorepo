import type { ReactElement } from 'react';

import type { ModalProps } from '@onekeyhq/components/src/Modal';
import type { IBaseExternalAccountInfo } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IUnsignedMessageBtc } from '@onekeyhq/engine/src/vaults/impl/btc/types';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  LNURLAuthServiceResponse,
  LNURLPayServiceResponse,
  LNURLPaymentSuccessAction,
  LNURLWithdrawServiceResponse,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';
import type {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoPayload,
  IFeeInfoSelected,
  INFTInfo,
  ISignedTxPro,
  IStakeInfo,
  ISwapInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { SendModalRoutes } from './enums';

import type { WalletService } from '../../components/WalletConnect/types';
import type { WalletConnectClientForDapp } from '../../components/WalletConnect/WalletConnectClientForDapp';
import type { CollectiblesRoutesParams } from '../../routes/Root/Modal/Collectibles';
import type { CollectiblesModalRoutes } from '../../routes/routesEnum';
import type { AmountTypeEnum } from '../BulkSender/types';
import type { InjectedConnectorInfo } from '../ExternalAccount/injectedConnectors';
import type { SwapQuoteTx } from '../Swap/typings';
import type { IWalletConnectSession } from '@walletconnect/types';

export { SendModalRoutes };

export type ISendAuthenticationModalTitleInfo = {
  title: string;
  subTitle: string;
};

export type TokenApproveAmountEditParams = {
  networkId: string;
  accountId: string;
  tokenApproveAmount: string;
  isMaxAmount: boolean;
  sourceInfo?: IDappSourceInfo | undefined;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx;
  sendConfirmParams: SendConfirmParams;
};

export type EditFeeParams = SendConfirmSharedParams & {
  sendConfirmParams?: SendConfirmParams;
  forBatchSend?: boolean;
};

export type PreSendParams = {
  networkId: string;
  accountId: string;
  closeModal?: () => any;
  transferInfos?: ITransferInfo[];
  validateAddress?: (
    networkId: string,
    address: string,
  ) => Promise<{
    warningMessage?: string;
  } | void>;
} & ITransferInfo;

export type LnUrlPayParams = PreSendParams & {
  lnurlDetails: LNURLPayServiceResponse;
  isSendFlow: boolean;
};

export type LnUrlWithdrawParams = {
  networkId: string;
  accountId: string;
  lnurlDetails: LNURLWithdrawServiceResponse;
  isSendFlow: boolean;
};
export type PreSendBRC20TokenAmountParams = {
  networkId: string;
  accountId: string;
  token: Token;
};

export type LnUrlAuthParams = {
  walletId: string;
  networkId: string;
  accountId: string;
  lnurlDetails: LNURLAuthServiceResponse;
  isSendFlow: boolean;
};

export type LnUrlAuthenticationParams = {
  onDone: (password: string) => void;
  walletId: string;
};

export type WeblnSendPaymentParams = {
  paymentRequest: string;
};

export type TransferSendParamsPayload = SendConfirmPayloadBase & {
  to: string;
  account: {
    id: string;
    name: string;
    address: string;
  };
  network: {
    id: string;
    name: string;
  };
  value: string;
  isMax: boolean;
  token: {
    idOnNetwork: string;
    logoURI: string;
    name: string;
    symbol: string;
    balance?: string;
    sendAddress?: string;
  } & Token;
};

export type SendConfirmFromDappParams = {
  query?: string;
};
export type SendConfirmActionType = 'speedUp' | 'cancel';
export type SendConfirmResendActionInfo = {
  type: SendConfirmActionType;
  replaceHistoryId?: string;
};
export type SendConfirmPayloadBase = {
  payloadType: 'Transfer' | 'InternalSwap';
};
export type SendConfirmPayload =
  | SendConfirmPayloadBase
  | TransferSendParamsPayload // ITransferInfo
  | SwapQuoteTx;
export type SendConfirmOnSuccessData = {
  signedTx?: ISignedTxPro;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx | null;
};
export type SendConfirmPayloadInfo = {
  type: 'Transfer' | 'InternalSwap' | 'InternalStake';
  transferInfo?: ITransferInfo;
  swapInfo?: ISwapInfo;
  stakeInfo?: IStakeInfo;
  nftInfo?: INFTInfo;
  nftInfos?: INFTInfo[];
};
export type SendConfirmSharedParams = {
  networkId: string;
  accountId: string;
  encodedTx?: IEncodedTx;
  resendActionInfo?: SendConfirmResendActionInfo;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
  onModalClose?: () => void;
};
export type SendConfirmParams = SendConfirmSharedParams & {
  payloadType?: string; // TODO remove
  payload?: SendConfirmPayload; // use payload.payloadType // TODO remove
  payloadInfo?: SendConfirmPayloadInfo;
  onSuccess?: (tx: ISignedTxPro, data?: SendConfirmOnSuccessData) => void;
  onFail?: (error: Error) => void;
  sourceInfo?: IDappSourceInfo;
  // TODO remove, use resendActionInfo instead
  actionType?: SendConfirmActionType; // 'speedUp' | 'cancel';
  // resendActionInfo?: SendConfirmResendActionInfo;
  backRouteName?: keyof SendRoutesParams;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
  prepaidFee?: string;
  onDetail?: (txid: string) => any;
  signOnly?: boolean;
  ignoreFetchFeeCalling?: boolean;
  hideSendFeedbackReceipt?: boolean;
  hideAdvancedSetting?: boolean;
};
export type SignMessageConfirmParams = SendConfirmSharedParams & {
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm | IUnsignedMessageBtc;
  onSuccess?: (result: any) => void;
  onFail?: (error?: Error) => void;
  hideToast?: boolean;
  closeImmediately?: boolean;
};
export type IWalletConnectExternalAccountInfo = {
  accountInfo?: IBaseExternalAccountInfo;
  session?: IWalletConnectSession;
  client?: WalletConnectClientForDapp;
  injectedConnectorInfo: InjectedConnectorInfo | undefined;
  walletService?: WalletService;
  currentNetwork: Network;
  currentAccount: Account;
};

export type SendAuthenticationParams = Omit<
  SendConfirmParams,
  'feeInfoEditable' | 'feeInfoUseFeeInTx'
> & {
  accountId: string;
  walletId: string;
  networkId: string;
  unsignedMessage?: IUnsignedMessageEvm | IUnsignedMessageBtc;
  encodedTx?: IEncodedTx;
};

export type SendSpecialWarningParams = SendAuthenticationParams & {
  hintMsgKey: string;
  hintMsgParams?: any;
};

export type SendFeedbackReceiptType =
  | 'Send'
  | 'Sign'
  | 'SendUnconfirmed'
  | 'LNURLWithdraw';

export type SendFeedbackReceiptParams = {
  networkId: string;
  accountId: string;
  txid: string;
  type: SendFeedbackReceiptType;
  closeModal?: () => any;
  onDetail?: (txid: string) => any;
  isSingleTransformMode?: boolean;
  successAction?: LNURLPaymentSuccessAction | null;
};

export type HardwareSwapContinueParams = {
  networkId: string;
  accountId: string;
  closeModal?: () => any;
};

type NFTDetailModalParams =
  CollectiblesRoutesParams[CollectiblesModalRoutes.NFTDetailModal];

export type SendRoutesParams = {
  [SendModalRoutes.PreSendToken]: PreSendParams;
  [SendModalRoutes.PreSendAddress]: PreSendParams;
  [SendModalRoutes.PreSendAmount]: PreSendParams;
  [SendModalRoutes.PreSendBRC20TokenAmount]: PreSendBRC20TokenAmountParams;
  [SendModalRoutes.SendEditFee]: EditFeeParams;
  [SendModalRoutes.TokenApproveAmountEdit]: TokenApproveAmountEditParams;
  [SendModalRoutes.SendConfirmFromDapp]: SendConfirmFromDappParams;
  [SendModalRoutes.SendConfirm]: SendConfirmParams;
  [SendModalRoutes.SendAuthentication]: SendAuthenticationParams;
  [SendModalRoutes.SendSpecialWarning]: SendSpecialWarningParams;
  [SendModalRoutes.SignMessageConfirm]: SignMessageConfirmParams;
  [SendModalRoutes.SendFeedbackReceipt]: SendFeedbackReceiptParams;
  [SendModalRoutes.HardwareSwapContinue]: HardwareSwapContinueParams;
  [SendModalRoutes.BatchSendConfirm]: BatchSendConfirmParams;
  [SendModalRoutes.BatchSendProgress]: BatchSendProgressParams;
  [SendModalRoutes.NFTDetailModal]: NFTDetailModalParams;
  [SendModalRoutes.LNURLPayRequest]: LnUrlPayParams;
  [SendModalRoutes.LNURLWithdraw]: LnUrlWithdrawParams;
  [SendModalRoutes.LNURLAuth]: LnUrlAuthParams;
  [SendModalRoutes.LNURLAuthentication]: LnUrlAuthenticationParams;
  [SendModalRoutes.WeblnSendPayment]: WeblnSendPaymentParams;
};

export type ITxConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  encodedTx,
}: {
  onClose?: () => void;
  close: () => void;
  encodedTx: IEncodedTx;
}) => void;

// TODO networkId, accountId, onSuccess
export type ITxConfirmViewProps = ModalProps & {
  networkId: string;
  accountId: string;
  // TODO rename sourceInfo
  sourceInfo?: IDappSourceInfo;
  encodedTx: IEncodedTx | null;
  decodedTx?: IDecodedTx | IDecodedTxLegacy | null;
  payload?: SendConfirmPayload;

  updateEncodedTxBeforeConfirm?: (encodedTx: IEncodedTx) => Promise<IEncodedTx>;
  handleConfirm: ITxConfirmViewPropsHandleConfirm;
  onEncodedTxUpdate?: (encodedTx: IEncodedTx) => void; // TODO remove

  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  feeInput?: JSX.Element | null;

  prepaidFee?: string;

  advancedSettings?: SendConfirmAdvancedSettings;
  advancedSettingsForm?: JSX.Element | null;
  feeInfoError?: Error | null;

  confirmDisabled?: boolean;
  autoConfirm?: boolean;
  children?: JSX.Element | JSX.Element[] | Element | Element[] | any;
  isListOrderPsbt?: boolean;

  sendConfirmParams: SendConfirmParams;
};
export type ISignMessageConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  unsignedMessage,
}: {
  onClose?: () => void;
  close: () => void;
  unsignedMessage: IUnsignedMessageEvm | IUnsignedMessageBtc;
}) => void;

export type ISignMessageConfirmViewProps = ModalProps & {
  networkId: string;
  accountId: string;
  // TODO rename sourceInfo
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm | IUnsignedMessageBtc;
  confirmDisabled?: boolean;
  handleConfirm: ISignMessageConfirmViewPropsHandleConfirm;
  children?: ReactElement;
};
export type IFeeInfoInputProps = {
  networkId: string;
  accountId: string;
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => JSX.Element | null;
  autoNavigateToEdit?: boolean;
  sendConfirmParams: SendConfirmParams;
};
export type ISendEditFeeValues = {
  gasPrice: string;
  gasLimit: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  baseFee: string;
  totalFee: string;
  feeRate: string;
  computeUnitPrice: string;
};

export type BatchSendConfirmPayloadInfo = {
  type: 'Transfer' | 'InternalSwap' | 'InternalStake';
  transferInfos?: ITransferInfo[];
  swapInfos?: ISwapInfo[];
  stakeInfos?: IStakeInfo[];
  nftInfos?: INFTInfo[];
  senderAccounts?: { accountId: string; walletId: string }[];
  tokenInfo?: Token;
};

export type BatchSendConfirmShared = {
  networkId: string;
  accountId: string;
  encodedTxs: IEncodedTx[];
  resendActionInfo?: SendConfirmResendActionInfo;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
  onModalClose?: () => void;
};

export type BatchSendConfirmParams = BatchSendConfirmShared & {
  payload?: SendConfirmPayload;
  payloadInfo?: BatchSendConfirmPayloadInfo;
  onSuccess?: (
    txs: ISignedTxPro[],
    data?: BatchSendConfirmOnSuccessData,
  ) => void;
  onFail?: (error: Error) => void;
  sourceInfo?: IDappSourceInfo;
  backRouteName?: keyof SendRoutesParams;
  onDetail?: (txid: string) => any;
  signOnly?: boolean;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
  feeInfoReuseable?: boolean;
  transferCount: number;
  skipSaveHistory?: boolean;
  bulkType: BulkTypeEnum;
  amountType?: AmountTypeEnum;
};

export type IBatchTxsConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  encodedTxs,
}: {
  onClose?: () => void;
  close: () => void;
  encodedTxs: IEncodedTx[];
}) => void;

export type IBatchTxsConfirmViewProps = ModalProps & {
  networkId: string;
  accountId: string;

  sourceInfo?: IDappSourceInfo;
  encodedTxs: IEncodedTx[];
  decodedTxs: (IDecodedTx | IDecodedTxLegacy)[];
  payload?: SendConfirmPayload;

  updateEncodedTxsBeforeConfirm?: (
    encodedTxs: IEncodedTx[],
  ) => Promise<IEncodedTx[]>;
  handleConfirm: IBatchTxsConfirmViewPropsHandleConfirm;
  onEncodedTxsUpdate?: (encodedTxs: IEncodedTx[]) => void; // TODO remove

  feeInfoPayloads: IFeeInfoPayload[];
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  totalFeeInNative: number;
  feeInput?: JSX.Element;
  tokenTransferInfo?: JSX.Element | null;
  isWaitingTxReady?: boolean;
  isSingleTransformMode?: boolean;

  confirmDisabled?: boolean;
  autoConfirm?: boolean;
  children?: JSX.Element | JSX.Element[] | Element | Element[] | any;

  batchSendConfirmParams: BatchSendConfirmParams;
};

export type BatchSendProgressParams = Omit<
  BatchSendConfirmParams,
  'feeInfoEditable' | 'feeInfoUseFeeInTx'
> & {
  accountId: string;
  walletId: string;
  networkId: string;
  unsignedMessages?: IUnsignedMessageEvm[];
  feeInfoPayloads: IFeeInfoPayload[];
};

export type BatchSendConfirmOnSuccessData = {
  signedTxs?: ISignedTxPro[];
  encodedTxs?: IEncodedTx[];
  decodedTxs?: IDecodedTx[];
  senderAccounts?: { accountId: string; walletId: string }[];
  isAborted?: boolean;
};

export type SendConfirmAdvancedSettings = {
  originalNonce: string;
  currentNonce: string;
  currentHexData: string;
  isCoinControlChecked: boolean;
  selectedUtxos: string[];
};

export enum EditableNonceStatusEnum {
  None = 'None',
  Equal = 'Equal',
  Less = 'Less',
  Greater = 'Greater',
}

export type BRC20TokenAmountItem = {
  amount: string;
  inscriptionId: string;
  inscriptionNumber: string;
};

export type BRC20TokenAmountListResponse = {
  balance: string;
  availableBalance: string;
  transferBalance: string;
  transferBalanceList: BRC20TokenAmountItem[];
};
