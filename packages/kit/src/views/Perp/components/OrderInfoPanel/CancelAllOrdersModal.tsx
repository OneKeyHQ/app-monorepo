import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActiveOpenOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useSpotActiveOpenOrdersAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../PerpDialogLayout';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

interface ICancelAllOrdersContentProps {
  onClose?: () => void;
  filterByCoin?: string;
}

function CancelAllOrdersContent({
  onClose,
  filterByCoin,
}: ICancelAllOrdersContentProps) {
  const actions = useHyperliquidActions();
  const intl = useIntl();
  const [{ openOrders: perpOpenOrders }] = usePerpsActiveOpenOrdersAtom();
  const [{ openOrders: spotOpenOrders }] = useSpotActiveOpenOrdersAtom();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ordersToProcess = useMemo(() => {
    const all = [...perpOpenOrders, ...spotOpenOrders];
    return filterByCoin ? all.filter((o) => o.coin === filterByCoin) : all;
  }, [perpOpenOrders, spotOpenOrders, filterByCoin]);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await actions.current.ensureTradingEnabled();
      const symbolsMetaMap =
        await backgroundApiProxy.serviceHyperliquid.getSymbolsMetaMap({
          coins: ordersToProcess.map((o) => o.coin),
        });
      const ordersToCancel = ordersToProcess
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
  }, [actions, isSubmitting, onClose, ordersToProcess]);

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

      <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
        <Button
          testID="perp-button-text-btn"
          variant="primary"
          size={PERP_DIALOG_BUTTON_SIZE}
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

export function showCancelAllOrdersDialog(filterByCoin?: string) {
  const dialogInstance = Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_cacenl_all_order_title,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <CancelAllOrdersContent
          onClose={() => {
            void dialogInstance.close();
          }}
          filterByCoin={filterByCoin}
        />
      </PerpsProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
