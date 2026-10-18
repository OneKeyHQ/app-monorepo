import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Toast,
  runAfterActionListClose,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import type { ITradingViewNativePriceSelection } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveTradeInstrumentAtom,
  usePerpsMidByCoin,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatHlPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

import { showSetTpslDialog } from '../components/OrderInfoPanel/SetTpslModal';
import { showLimitOrderDialog } from '../components/TradingPanel/panels/LimitOrderForm';
import {
  getPerpsAccountKey,
  isPerpsAccountSelectionResolved,
} from '../utils/accountScopedData';

import { useActiveTradeDisplay } from './useActiveTradeDisplay';
import { usePerpsAccountScopedActivePositions } from './usePerpsAccountScopedActivePositions';

export function usePerpsChartOrderMenu(enabled: boolean) {
  const intl = useIntl();
  const [instrument] = useActiveTradeInstrumentAtom();
  const [account] = usePerpsActiveAccountAtom();
  const [loading] = usePerpsAccountLoadingInfoAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { displayName, baseName } = useActiveTradeDisplay();
  const positions = usePerpsAccountScopedActivePositions();
  const midPrice = usePerpsMidByCoin(instrument.coin);
  const accountKey = getPerpsAccountKey(account);
  const scope = useMemo(
    () => ({ coin: instrument.coin, accountKey }),
    [instrument.coin, accountKey],
  );
  const szDecimals =
    instrument.mode === 'spot'
      ? instrument.universe?.baseSzDecimals
      : instrument.universe?.szDecimals;
  const ready =
    enabled &&
    szDecimals !== undefined &&
    isPerpsAccountSelectionResolved({
      selectedWalletReady: activeAccount.ready,
      selectAccountLoading: loading.selectAccountLoading,
      selectedAccountId: activeAccount.account?.id,
      selectedIndexedAccountId: activeAccount.indexedAccount?.id,
      activeAccountId: account.accountId,
      activeIndexedAccountId: account.indexedAccountId,
    });
  const latest = useRef({ scope, ready, positions, midPrice });
  latest.current = { scope, ready, positions, midPrice };
  const menu = useRef<ReturnType<typeof ActionList.show> | null>(null);
  const dialog = useRef<IDialogInstance | null>(null);
  const mounted = useRef(false);
  const close = useCallback(() => {
    menu.current?.close();
    menu.current = null;
    if (dialog.current?.isExist()) void dialog.current.close();
    dialog.current = null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      close();
    };
  }, [scope, ready, close]);

  const onPriceSelect = useCallback(
    ({
      price: selectedPrice,
      screenX,
      screenY,
      onClose,
    }: ITradingViewNativePriceSelection) => {
      const isCurrent = () =>
        mounted.current &&
        latest.current.scope === scope &&
        latest.current.ready;
      if (
        !isCurrent() ||
        !Number.isFinite(selectedPrice) ||
        selectedPrice <= 0
      ) {
        onClose?.();
        return;
      }
      if (szDecimals === undefined) {
        onClose?.();
        return;
      }
      const price = formatHlPrice(selectedPrice, szDecimals, instrument.mode);
      if (!price || Number(price) <= 0) {
        onClose?.();
        return;
      }
      const getTpsl = () => {
        const position = latest.current.positions.find(
          (item) => item.position.coin === scope.coin,
        )?.position;
        const size = Number(position?.szi);
        const mid = Number(latest.current.midPrice);
        if (
          instrument.mode !== 'perp' ||
          !Number.isFinite(size) ||
          size === 0 ||
          !Number.isFinite(mid) ||
          mid <= 0 ||
          Number(price) === mid
        )
          return undefined;
        const isAboveMid = Number(price) > mid;
        const isLong = size > 0;
        return isAboveMid === isLong ? 'tp' : 'sl';
      };
      const openLimit = () => {
        if (!isCurrent()) return;
        close();
        dialog.current = showLimitOrderDialog({
          symbol: scope.coin,
          price,
          displayPair: displayName,
          displayCoin: baseName,
          intl,
        });
      };
      const openTpsl = (tpsl: 'tp' | 'sl') => {
        if (
          !isCurrent() ||
          instrument.mode !== 'perp' ||
          instrument.assetId === undefined
        )
          return;
        if (getTpsl() !== tpsl) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.order_changed_try_again__msg,
            }),
          });
          return;
        }
        close();
        dialog.current = showSetTpslDialog({
          coin: scope.coin,
          szDecimals,
          assetId: instrument.assetId,
          presetTriggerPrice: price,
          presetTpsl: tpsl,
          intl,
        });
      };
      close();
      const labelValues = { coin: baseName, price };
      const tpsl = getTpsl();
      menu.current = ActionList.show({
        onClose,
        title: `${displayName} · ${price}`,
        triggerPosition: { x: screenX, y: screenY },
        items: [
          {
            label: intl.formatMessage(
              { id: ETranslations.perps_chart_limit_order__action },
              labelValues,
            ),
            onPress: (closeMenu) =>
              runAfterActionListClose(closeMenu, openLimit),
            testID: 'perps-chart-limit-order',
          },
          ...(tpsl
            ? [
                {
                  label: intl.formatMessage(
                    {
                      id:
                        tpsl === 'tp'
                          ? ETranslations.perps_chart_take_profit__action
                          : ETranslations.perps_chart_stop_loss__action,
                    },
                    labelValues,
                  ),
                  onPress: (closeMenu: () => void) =>
                    runAfterActionListClose(closeMenu, () => openTpsl(tpsl)),
                  testID:
                    tpsl === 'tp'
                      ? 'perps-chart-take-profit'
                      : 'perps-chart-stop-loss',
                },
              ]
            : []),
        ],
      });
    },
    [scope, instrument, szDecimals, displayName, baseName, intl, close],
  );

  return {
    onPriceSelect: ready ? onPriceSelect : undefined,
    priceSelectionLabel: intl.formatMessage({
      id: ETranslations.perp_trade_limit,
    }),
  };
}
