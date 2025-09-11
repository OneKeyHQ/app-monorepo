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

import { showOrderConfirmDialog } from './modals/OrderConfirmModal';
import { PerpTradingForm } from './panels/PerpTradingForm';

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
    <YStack gap="$2" p="$4">
      <PerpTradingForm isSubmitting={isSubmitting} />

      {loading ? (
        <Button size="meduium" borderRadius="$2" disabled>
          <Spinner />
        </Button>
      ) : (
        <>
          {!currentUser ? (
            <Button size="meduium" borderRadius="$2" onPress={() => {}}>
              <SizableText>Connect wallet</SizableText>
            </Button>
          ) : null}

          {!canTrade ? (
            <Button
              size="meduium"
              borderRadius="$2"
              onPress={() => {
                void checkAndApproveWallet();
              }}
            >
              <SizableText>Enable trading</SizableText>
            </Button>
          ) : null}

          {canTrade ? (
            <Button
              bg="$green11"
              hoverStyle={{ bg: '$green10' }}
              pressStyle={{
                bg: '$green10',
              }}
              onPress={() => {
                if (!canTrade) {
                  void checkAndApproveWallet();
                } else {
                  handleShowConfirm();
                }
              }}
              disabled={buttonDisabled}
              size="meduium"
              borderRadius="$2"
            >
              <SizableText color="$textOnColor" size="$bodyMdMedium">
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
