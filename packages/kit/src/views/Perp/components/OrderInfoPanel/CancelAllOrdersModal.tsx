import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useHyperliquidActions,
  usePerpsActiveOpenOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  useSpotActiveOpenOrdersAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { usePerpsAccountScopedCacheAddress } from '../../hooks/usePerpsAccountScopedCacheAddress';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import {
  getPerpsAccountScopedListData,
  isPerpsAccountAddressMatched,
} from '../../utils/accountScopedData';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../PerpDialogLayout';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

interface ICancelAllOrdersContentProps {
  onClose?: () => void;
  filterByCoin?: string;
  scopedAccountAddress?: string | null;
}

function CancelAllOrdersContent({
  onClose,
  filterByCoin,
  scopedAccountAddress,
}: ICancelAllOrdersContentProps) {
  const actions = useHyperliquidActions();
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const currentScopedAccountAddress = usePerpsAccountScopedCacheAddress();
  const effectiveScopedAccountAddress =
    scopedAccountAddress ?? currentScopedAccountAddress;
  const [
    {
      accountAddress: perpOpenOrdersAccountAddress,
      openOrders: perpOpenOrders,
    },
  ] = usePerpsActiveOpenOrdersAtom();
  const [
    {
      accountAddress: spotOpenOrdersAccountAddress,
      openOrders: spotOpenOrders,
    },
  ] = useSpotActiveOpenOrdersAtom();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = isPerpsAccountAddressMatched({
    activeAccountAddress: activeAccount?.accountAddress,
    dataAccountAddress: effectiveScopedAccountAddress,
  });

  const ordersToProcess = useMemo(() => {
    const scopedPerpOpenOrders = getPerpsAccountScopedListData({
      activeAccountAddress: effectiveScopedAccountAddress,
      dataAccountAddress: perpOpenOrdersAccountAddress,
      data: perpOpenOrders,
    });
    const scopedSpotOpenOrders = getPerpsAccountScopedListData({
      activeAccountAddress: effectiveScopedAccountAddress,
      dataAccountAddress: spotOpenOrdersAccountAddress,
      data: spotOpenOrders,
    });
    const all = [...scopedPerpOpenOrders, ...scopedSpotOpenOrders];
    return filterByCoin ? all.filter((o) => o.coin === filterByCoin) : all;
  }, [
    effectiveScopedAccountAddress,
    filterByCoin,
    perpOpenOrders,
    perpOpenOrdersAccountAddress,
    spotOpenOrders,
    spotOpenOrdersAccountAddress,
  ]);

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !canSubmit) return;

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
  }, [actions, canSubmit, isSubmitting, onClose, ordersToProcess]);

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
          disabled={isSubmitting || !canSubmit || ordersToProcess.length === 0}
          loading={isSubmitting}
          onPress={handleConfirm}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showCancelAllOrdersDialog(
  filterByCoin?: string,
  scopedAccountAddress?: string | null,
) {
  const dialogInstance = Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_cacenl_all_order_title,
    }),
    renderContent: (
      <PerpsAccountSelectorProviderMirror>
        <PerpsProviderMirror>
          <CancelAllOrdersContent
            onClose={() => {
              void dialogInstance.close();
            }}
            filterByCoin={filterByCoin}
            scopedAccountAddress={scopedAccountAddress}
          />
        </PerpsProviderMirror>
      </PerpsAccountSelectorProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
