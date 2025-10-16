import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActiveOpenOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

interface ICancelAllOrdersContentProps {
  onClose?: () => void;
}

function CancelAllOrdersContent({ onClose }: ICancelAllOrdersContentProps) {
  const actions = useHyperliquidActions();
  const intl = useIntl();
  const [{ openOrders: orders }] = usePerpsActiveOpenOrdersAtom();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await actions.current.ensureTradingEnabled();
      const symbolsMetaMap =
        await backgroundApiProxy.serviceHyperliquid.getSymbolsMetaMap({
          coins: orders.map((o) => o.coin),
        });
      const ordersToCancel = orders
        .map((order) => {
          const tokenInfo = symbolsMetaMap[order.coin];
          if (!tokenInfo || isNil(tokenInfo?.assetId)) {
            console.warn(`Token info not found for coin: ${order.coin}`);
            return null;
          }
          return {
            assetId: tokenInfo.assetId,
            oid: order.oid,
          };
        })
        .filter(Boolean);

      if (ordersToCancel.length === 0) {
        console.warn('No valid orders to cancel or token info unavailable');
        onClose?.();
        return;
      }

      await actions.current.cancelOrder({ orders: ordersToCancel });
      onClose?.();
    } catch (error) {
      console.error('Cancel all orders failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [actions, isSubmitting, onClose, orders]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return intl.formatMessage({
        id: ETranslations.Limit_order_history_status_canceling,
      });
    }
    return intl.formatMessage({
      id: ETranslations.global_confirm,
    });
  }, [isSubmitting, intl]);

  return (
    <YStack gap="$4" p="$1">
      {/* Description */}
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_cacenl_all_order_msg,
        })}
      </SizableText>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          loading={isSubmitting}
          onPress={handleConfirm}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showCancelAllOrdersDialog() {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_cacenl_all_order_title,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <CancelAllOrdersContent
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
