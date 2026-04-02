import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import { usePendleTransactionDetails } from '../components/ProtocolDetails/PendleSharedComponents';

import { useIsPendleProvider } from './useIsPendleProvider';

import type { IManagePageV2ReceiveInputConfig } from '../components/ManagePageV2ReceiveInput';

const ARROW_OVERLAY_OFFSET = -13;

type IUsePendleLayoutStateParams = {
  providerName: string;
  transactionConfirmation: IStakeTransactionConfirmation | undefined;
  amountValue: string;
  showApyDetail: boolean;
  receiveInputConfig: IManagePageV2ReceiveInputConfig | undefined;
  networkLogoURI: string | undefined;
  isQuoteExpired: boolean | undefined;
  loading?: boolean;
};

export function usePendleLayoutState({
  providerName,
  transactionConfirmation,
  amountValue,
  showApyDetail,
  receiveInputConfig,
  networkLogoURI,
  isQuoteExpired,
  loading,
}: IUsePendleLayoutStateParams) {
  const isPendleProvider = useIsPendleProvider(providerName);
  const isPendleLikeLayout = isPendleProvider;

  const normalizedPendleTipText = useMemo(() => {
    if (!isPendleProvider) {
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
  }, [isPendleProvider, transactionConfirmation?.tip?.text]);

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
  const showApyHeader = showApyDetail && !!apyDetail && !isPendleLikeLayout;
  const hasLegacySummaryContent =
    !!transactionConfirmation?.title ||
    !!transactionConfirmation?.tooltip ||
    (transactionConfirmation?.rewards?.length ?? 0) > 0;
  const hasSummarySection =
    showApyHeader || usePendleSummaryLayout || hasLegacySummaryContent;

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
    isQuoteExpired &&
    isPendleProvider &&
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
    isPendleProvider,
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
