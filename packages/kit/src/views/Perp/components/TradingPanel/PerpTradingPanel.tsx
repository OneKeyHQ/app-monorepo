import { memo, useCallback, useMemo } from 'react';

import { Button, SizableText, Spinner, YStack } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import {
  useCurrentTokenData,
  useHyperliquidAccount,
  useHyperliquidTrading,
} from '../../hooks';

import { showOrderConfirmDialog } from './OrderConfirmModal';
import { PerpTradingForm } from './PerpTradingForm';

function PerpTradingPanel() {
  const { canTrade, loading, currentUser, checkAndApproveWallet } =
    useHyperliquidTrading();
  const { accountSummary } = useHyperliquidAccount();
  const tokenInfo = useCurrentTokenData();
  const [formData] = useTradingFormAtom();
  const [isSubmitting] = useTradingLoadingAtom();

  const leverage = useMemo(() => {
    return tokenInfo?.leverage?.value || tokenInfo?.maxLeverage || 1;
  }, [tokenInfo]);

  const maxTradeSz = useMemo(() => {
    const maxTradeSzs = tokenInfo?.maxTradeSzs || [0, 0];
    return maxTradeSzs[formData.side === 'long' ? 0 : 1];
  }, [tokenInfo?.maxTradeSzs, formData.side]);

  const isNoEnoughMargin = useMemo(() => {
    if (formData.type === 'limit') {
      return (
        (+formData.price * +formData.size) / leverage >
        +(accountSummary?.withdrawable || 0)
      );
    }
    return +formData.size > maxTradeSz;
  }, [
    formData.size,
    maxTradeSz,
    formData.type,
    accountSummary?.withdrawable,
    formData.price,
    leverage,
  ]);

  const buttonDisabled = useMemo(() => {
    return !canTrade || isSubmitting || isNoEnoughMargin;
  }, [canTrade, isSubmitting, isNoEnoughMargin]);

  const buttonText = useMemo(() => {
    if (isSubmitting) return 'Placing...';
    if (isNoEnoughMargin) return 'No Enough Margin';
    return 'Place order';
  }, [isSubmitting, isNoEnoughMargin]);

  const buttonStyles = useMemo(() => {
    const isLong = formData.side === 'long';

    const getBgColor = () => {
      return isLong ? '$buttonSuccess' : '$buttonCritical';
    };

    const getHoverBgColor = () => {
      return isLong ? '$green7' : '$red7';
    };

    const getPressBgColor = () => {
      return isLong ? '$green9' : '$red9';
    };

    return {
      bg: getBgColor(),
      hoverBg: getHoverBgColor(),
      pressBg: getPressBgColor(),
      textColor: buttonDisabled ? '$textDisabled' : '$textOnColor',
    };
  }, [formData.side, buttonDisabled]);

  const actions = useHyperliquidActions();
  const handleShowConfirm = useCallback(() => {
    if (!tokenInfo) {
      console.error(
        '[PerpTradingPanel.handleShowConfirm] No token info available',
      );
      return;
    }
    const liquidationPrice = '';

    showOrderConfirmDialog({
      formData,
      tokenName: tokenInfo.name,
      liquidationPrice,
      onConfirm: async () => {
        try {
          if (formData.type === 'market') {
            await actions.current.marketOrderOpen({
              assetId: tokenInfo.assetId,
              formData,
              slippage: 0.08,
              midPx: tokenInfo.markPx || '0',
            });
          } else {
            await actions.current.placeOrder({
              assetId: tokenInfo.assetId,
              formData,
            });
          }

          // Reset form after successful order
          actions.current.resetTradingForm();
        } catch (error) {
          console.error(
            '[PerpTradingPanel.handleConfirm] Failed to place order:',
            error,
          );
          throw error;
        }
      },
    });
  }, [tokenInfo, formData, actions]);

  return (
    <YStack gap="$4" p="$4">
      <PerpTradingForm isSubmitting={isSubmitting} />

      {loading ? (
        <Button size="large" borderRadius="$3" disabled>
          <Spinner />
        </Button>
      ) : (
        <>
          {!currentUser ? (
            <Button size="large" borderRadius="$3" onPress={() => {}}>
              <SizableText>Connect wallet</SizableText>
            </Button>
          ) : null}

          {!canTrade ? (
            <Button
              size="large"
              borderRadius="$3"
              onPress={() => {
                void checkAndApproveWallet();
              }}
            >
              <SizableText>Enable trading</SizableText>
            </Button>
          ) : null}

          {canTrade ? (
            <Button
              bg={buttonStyles.bg}
              hoverStyle={{ bg: buttonStyles.hoverBg }}
              pressStyle={{ bg: buttonStyles.pressBg }}
              onPress={() => {
                if (!canTrade) {
                  void checkAndApproveWallet();
                } else {
                  handleShowConfirm();
                }
              }}
              disabled={buttonDisabled}
              size="large"
              borderRadius="$3"
            >
              <SizableText
                color={buttonStyles.textColor}
                fontWeight="600"
                size="$bodyLgMedium"
              >
                {buttonText}
              </SizableText>
            </Button>
          ) : null}
        </>
      )}
    </YStack>
  );
}

const PerpTradingPanelMemo = memo(PerpTradingPanel);
export { PerpTradingPanelMemo as PerpTradingPanel };
