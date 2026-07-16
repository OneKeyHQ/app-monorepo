import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSignatureConfirmParamList } from '@onekeyhq/shared/src/routes';
import { EModalSignatureConfirmRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

// The current send flow is hosted by SignatureConfirmModal. TxConfirm is the
// shared send/transaction confirmation screen used by wallet, DApp, and swap
// entries. Legacy SendModal confirmation routes are expected to be removed in
// 6.7.0; debug confirmation issues in TxConfirm instead.
const TxConfirmFromDApp = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Send/pages/SendConfirmFromDApp/SendConfirmFromDApp'),
);

const MessageConfirmFromDApp = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/SignatureConfirm/pages/MessageConfirm/MessageConfirmFromDapp'),
);
const TxConfirmFromSwap = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Send/pages/SendConfirmFromSwap/SendConfirmFromSwap'),
);

const TxTokenSelector = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AssetSelector/pages/TokenSelector'),
);

const TxAggregateTokenSelector = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/AssetSelector/pages/AggregateTokenSelector'),
);

const TxDeriveTypesAddress = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/WalletAddress/pages/DeriveTypesAddress'),
);

const TxDataInput = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Send/pages/SendDataInput/SendDataInputContainer'),
);

const TxAmountInput = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Send/pages/SendAmountInput/SendAmountInputContainer'),
);

const TxReplace = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Send/pages/SendReplaceTx/SendReplaceTxContainer'),
);

const TxConfirm = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/SignatureConfirm/pages/TxConfirm/TxConfirm'),
);

const MessageConfirm = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/SignatureConfirm/pages/MessageConfirm/MessageConfirm'),
);

const LnurlPayRequestModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlPayRequestModal'),
);

const LnurlWithdrawModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlWithdrawModal'),
);

const LnurlAuthModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/LightningNetwork/pages/Send/LnurlAuthModal'),
);

const WeblnSendPaymentModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/LightningNetwork/pages/Webln/WeblnSendPaymentModal'),
);

export const ModalSignatureConfirmStack: IModalFlowNavigatorConfig<
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList
>[] = [
  // Extension standalone windows cold-start from a hash URL built by
  // ServiceDApp.openModal. Keep every screen in this stack available to the
  // Extension compiler target without exposing these internal routes on Web.
  {
    name: EModalSignatureConfirmRoutes.TxConfirm,
    component: TxConfirm,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EModalSignatureConfirmRoutes.MessageConfirm,
    component: MessageConfirm,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EModalSignatureConfirmRoutes.TxConfirmFromDApp,
    component: TxConfirmFromDApp,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EModalSignatureConfirmRoutes.MessageConfirmFromDApp,
    component: MessageConfirmFromDApp,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EModalSignatureConfirmRoutes.TxConfirmFromSwap,
    component: TxConfirmFromSwap,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.TxDataInput,
    component: TxDataInput,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.TxAmountInput,
    component: TxAmountInput,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.TxReplace,
    component: TxReplace,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.TxSelectToken,
    component: TxTokenSelector,
    allowColdStart: platformEnv.isExtension,
  },
  {
    name: EModalSignatureConfirmRoutes.TxSelectAggregateToken,
    component: TxAggregateTokenSelector,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.TxSelectDeriveAddress,
    component: TxDeriveTypesAddress,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.LnurlPayRequest,
    component: LnurlPayRequestModal,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.LnurlWithdraw,
    component: LnurlWithdrawModal,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.WeblnSendPayment,
    component: WeblnSendPaymentModal,
    allowColdStart: platformEnv.isExtension,
  },

  {
    name: EModalSignatureConfirmRoutes.LnurlAuth,
    component: LnurlAuthModal,
    allowColdStart: platformEnv.isExtension,
  },
];
