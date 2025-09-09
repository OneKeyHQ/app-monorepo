import { memo, useCallback } from 'react';

import { Button, SizableText, Spinner, YStack } from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useTradingFormAtom,
  useTradingLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useCurrentTokenData, useHyperliquidTrading } from '../../hooks';

import { showOrderConfirmDialog } from './OrderConfirmModal';
import { PerpTradingForm } from './PerpTradingForm';

function PerpTradingPanel() {
  const { canTrade, loading, currentUser, checkAndApproveWallet } =
    useHyperliquidTrading();
  const tokenInfo = useCurrentTokenData();
  const [formData] = useTradingFormAtom();
  const [isSubmitting] = useTradingLoadingAtom();
  const actions = useHyperliquidActions();
  const handleShowConfirm = useCallback(() => {
    if (!tokenInfo) {
      console.error(
        '[PerpTradingPanel.handleShowConfirm] No token info available',
      );
      return;
    }

    showOrderConfirmDialog({
      formData,
      tokenName: tokenInfo.name,
      liquidationPrice: '-', // TODO: Calculate actual liquidation price
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
              bg={(() => {
                if (!canTrade || isSubmitting) return '$gray7';
                return formData.side === 'long'
                  ? '$buttonSuccess'
                  : '$buttonCritical';
              })()}
              hoverStyle={{
                bg: (() => {
                  if (!canTrade || isSubmitting) return '$gray7';
                  return formData.side === 'long' ? '$green7' : '$red7';
                })(),
              }}
              pressStyle={{
                bg: (() => {
                  if (!canTrade || isSubmitting) return '$gray7';
                  return formData.side === 'long' ? '$green9' : '$red9';
                })(),
              }}
              onPress={() => {
                if (!canTrade) {
                  void checkAndApproveWallet();
                } else {
                  handleShowConfirm();
                }
              }}
              disabled={!canTrade || isSubmitting}
              size="large"
              borderRadius="$3"
            >
              <SizableText
                color={(() => {
                  if (!canTrade || isSubmitting) return '$textDisabled';
                  return '$textOnColor';
                })()}
                fontWeight="600"
                size="$bodyLgMedium"
              >
                {isSubmitting ? 'Placing...' : 'Place order'}
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
