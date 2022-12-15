import { ModalProps } from '@onekeyhq/components/src/Modal';
import type { IBaseExternalAccountInfo } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoPayload,
  IFeeInfoSelected,
  INFTInfo,
  ISignedTx,
  IStakeInfo,
  ISwapInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import { InjectedConnectorInfo } from '../ExternalAccount/injectedConnectors';

import { SendRoutes } from './enums';

import type { WalletService } from '../../components/WalletConnect/types';
import type { WalletConnectClientForDapp } from '../../components/WalletConnect/WalletConnectClientForDapp';
import type { SwapQuoteTx } from '../Swap/typings';
import type { IWalletConnectSession } from '@walletconnect/types';

export { SendRoutes };

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
} & ITransferInfo;

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
  };
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
  signedTx?: ISignedTx;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx | null;
};
export type SendConfirmPayloadInfo = {
  type: 'Transfer' | 'InternalSwap' | 'InternalStake';
  transferInfo?: ITransferInfo;
  swapInfo?: ISwapInfo;
  stakeInfo?: IStakeInfo;
  nftInfo?: INFTInfo;
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
  onSuccess?: (tx: ISignedTx, data?: SendConfirmOnSuccessData) => void;
  onFail?: (error: Error) => void;
  sourceInfo?: IDappSourceInfo;
  // TODO remove, use resendActionInfo instead
  actionType?: SendConfirmActionType; // 'speedUp' | 'cancel';
  // resendActionInfo?: SendConfirmResendActionInfo;
  backRouteName?: keyof SendRoutesParams;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
  onDetail?: (txid: string) => any;
  signOnly?: boolean;
  skipSaveHistory?: boolean;
};
export type SignMessageConfirmParams = SendConfirmSharedParams & {
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm;
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
  unsignedMessage?: IUnsignedMessageEvm;
  encodedTx?: IEncodedTx;
};

export type SendFeedbackReceiptParams = {
  networkId: string;
  accountId: string;
  txid: string;
  type: 'Send' | 'Sign' | 'SendUnconfirmed';
  closeModal?: () => any;
  onDetail?: (txid: string) => any;
  isSingleTransformMode?: boolean;
};

export type HardwareSwapContinueParams = {
  networkId: string;
  accountId: string;
  closeModal?: () => any;
};

export type SendRoutesParams = {
  [SendRoutes.PreSendToken]: PreSendParams;
  [SendRoutes.PreSendAddress]: PreSendParams;
  [SendRoutes.PreSendAmount]: PreSendParams;
  [SendRoutes.SendEditFee]: EditFeeParams;
  [SendRoutes.TokenApproveAmountEdit]: TokenApproveAmountEditParams;
  [SendRoutes.SendConfirmFromDapp]: SendConfirmFromDappParams;
  [SendRoutes.SendConfirm]: SendConfirmParams;
  [SendRoutes.SendAuthentication]: SendAuthenticationParams;
  [SendRoutes.SignMessageConfirm]: SignMessageConfirmParams;
  [SendRoutes.SendFeedbackReceipt]: SendFeedbackReceiptParams;
  [SendRoutes.HardwareSwapContinue]: HardwareSwapContinueParams;
  [SendRoutes.BatchSendConfirm]: BatchSendConfirmParams;
  [SendRoutes.BatchSendProgress]: BatchSendProgressParams;
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
  feeInput?: JSX.Element;

  confirmDisabled?: boolean;
  autoConfirm?: boolean;
  children?: JSX.Element | JSX.Element[] | Element | Element[] | any;

  sendConfirmParams: SendConfirmParams;
};
export type ISignMessageConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  unsignedMessage,
}: {
  onClose?: () => void;
  close: () => void;
  unsignedMessage: IUnsignedMessageEvm;
}) => void;

export type ISignMessageConfirmViewProps = ModalProps & {
  networkId: string;
  accountId: string;
  // TODO rename sourceInfo
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm;
  confirmDisabled?: boolean;
  handleConfirm: ISignMessageConfirmViewPropsHandleConfirm;
  children?: React.ReactElement;
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
};

export type BatchSendConfirmPayloadInfo = {
  type: 'Transfer' | 'InternalSwap' | 'InternalStake';
  transferInfos?: ITransferInfo[];
  swapInfos?: ISwapInfo[];
  stakeInfos?: IStakeInfo[];
  nftInfos?: INFTInfo[];
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
  onSuccess?: (txs: ISignedTx[], data?: BatchSendConfirmOnSuccessData) => void;
  onFail?: (error: Error) => void;
  sourceInfo?: IDappSourceInfo;
  backRouteName?: keyof SendRoutesParams;
  onDetail?: (txid: string) => any;
  signOnly?: boolean;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
  transferCount: number;
  skipSaveHistory?: boolean;
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
};

export type BatchSendConfirmOnSuccessData = {
  signedTxs?: ISignedTx[];
  encodedTxs?: IEncodedTx[];
  decodedTxs?: IDecodedTx[];
};
