import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ECheckAmountActionType,
  IEarnStakeType,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { usePendleTransactionDetails } from '../components/ProtocolDetails/PendleSharedComponents';

import type { IEarnTransactionLayout } from '../../Earn/protocols/EarnProtocol';
import type { IManagePageV2ReceiveInputConfig } from '../components/ManagePageV2ReceiveInput';

const ARROW_OVERLAY_OFFSET = -13;

type IUsePendleLayoutStateParams = {
  transactionLayout: IEarnTransactionLayout;
  transactionConfirmation: IStakeTransactionConfirmation | undefined;
  amountValue: string;
  showApyDetail: boolean;
  receiveInputConfig: IManagePageV2ReceiveInputConfig | undefined;
  networkLogoURI: string | undefined;
  isQuoteExpired: boolean | undefined;
  loading?: boolean;
  stakeType?: IEarnStakeType;
  action?: ECheckAmountActionType | 'approve';
  hideYieldPreview?: boolean;
};

export function usePendleLayoutState({
  transactionLayout,
  transactionConfirmation,
  amountValue,
  showApyDetail,
  receiveInputConfig,
  networkLogoURI,
  isQuoteExpired,
  loading,
  stakeType,
  action,
  hideYieldPreview,
}: IUsePendleLayoutStateParams) {
  const isPendleLikeLayout = transactionLayout === 'market';
  const isPreparationStep = stakeType === 'wrap' || action === 'approve';
  const shouldHideYield = isPreparationStep || hideYieldPreview;

  const normalizedPendleTipText = useMemo(() => {
    if (!isPendleLikeLayout) {
      return undefined;
    }
    const tipText = transactionConfirmation?.tip?.text;
    const normalizedText = tipText?.text?.trim();
    if (!normalizedText) {
      return undefined;
    }
    return {
      ...tipText,
      text: normalizedText,
    };
  }, [isPendleLikeLayout, transactionConfirmation?.tip?.text]);

  const pendleAccordionItems = usePendleTransactionDetails({
    transactionConfirmation,
    amountValue,
    isPendleLikeLayout,
    loading,
  });

  const pendleRewardRows = useMemo(
    () =>
      isPendleLikeLayout
        ? (transactionConfirmation?.rewards ?? []).filter(
            (reward) =>
              !!reward?.title?.text?.trim() &&
              !!reward?.description?.text?.trim(),
          )
        : [],
    [isPendleLikeLayout, transactionConfirmation?.rewards],
  );

  const isPendleLoading = isPendleLikeLayout && !!loading;
  const usePendleSummaryLayout = pendleRewardRows.length > 0 || isPendleLoading;

  const transactionDetailsTriggerText =
    transactionConfirmation?.transactionDetails?.text;
  const apyDetail = transactionConfirmation?.apyDetail;
  const showApyHeader =
    !shouldHideYield && showApyDetail && !!apyDetail && !isPendleLikeLayout;
  const hasLegacySummaryContent =
    !!transactionConfirmation?.title ||
    !!transactionConfirmation?.tooltip ||
    // availableLiquidity 行渲染在 summary 分支内，必须纳入可见性判定，
    // 否则服务端只下发 availableLiquidity 时整个 summary 区被跳过 (PR#12636 review)
    !!transactionConfirmation?.availableLiquidity ||
    (transactionConfirmation?.rewards?.length ?? 0) > 0;
  const hasSummarySection =
    !shouldHideYield &&
    (showApyHeader || usePendleSummaryLayout || hasLegacySummaryContent);

  const pendleTipText =
    isPendleLikeLayout && normalizedPendleTipText
      ? normalizedPendleTipText
      : undefined;

  const showPendleTransactionSection = useMemo(() => {
    if (!isPendleLikeLayout) {
      return true;
    }
    return (
      !!transactionDetailsTriggerText?.text && pendleAccordionItems.length > 0
    );
  }, [
    isPendleLikeLayout,
    transactionDetailsTriggerText?.text,
    pendleAccordionItems.length,
  ]);

  const showExpiredRefresh =
    !isPreparationStep &&
    isQuoteExpired &&
    isPendleLikeLayout &&
    !!amountValue &&
    Number(amountValue) > 0;

  const showReceiveInput = !!receiveInputConfig?.enabled;
  const effectiveReceiveInputConfig = useMemo(
    () =>
      receiveInputConfig
        ? {
            ...receiveInputConfig,
            networkImageUri:
              receiveInputConfig.networkImageUri ?? networkLogoURI,
          }
        : undefined,
    [receiveInputConfig, networkLogoURI],
  );

  const receiveArrowOverlayStyle = useMemo(() => {
    if (!platformEnv.isNative) {
      return { transform: 'translate(-50%, -50%)' as const };
    }
    return {
      transform: [
        { translateX: ARROW_OVERLAY_OFFSET },
        { translateY: ARROW_OVERLAY_OFFSET },
      ] as const,
    };
  }, []);

  return {
    isPendleLikeLayout,
    normalizedPendleTipText,
    pendleAccordionItems,
    pendleRewardRows,
    usePendleSummaryLayout,
    transactionDetailsTriggerText,
    apyDetail,
    showApyHeader,
    hasLegacySummaryContent,
    hasSummarySection,
    pendleTipText,
    showPendleTransactionSection,
    showExpiredRefresh,
    showReceiveInput,
    effectiveReceiveInputConfig,
    receiveArrowOverlayStyle,
  };
}
