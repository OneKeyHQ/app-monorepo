import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, runAfterActionListClose } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import type { ITradingViewNativePriceSelection } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
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
  const latest = useRef({ scope, ready, positions });
  latest.current = { scope, ready, positions };
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
    }: ITradingViewNativePriceSelection) => {
      const isCurrent = () =>
        mounted.current &&
        latest.current.scope === scope &&
        latest.current.ready;
      if (!isCurrent() || !Number.isFinite(selectedPrice) || selectedPrice <= 0)
        return;
      if (szDecimals === undefined) return;
      const price = formatHlPrice(selectedPrice, szDecimals, instrument.mode);
      if (!price || Number(price) <= 0) return;
      const hasPosition = () =>
        latest.current.positions.some(
          ({ position }) =>
            position.coin === scope.coin && Number(position.szi) !== 0,
        );
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
          !hasPosition() ||
          instrument.mode !== 'perp' ||
          instrument.assetId === undefined
        )
          return;
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
      menu.current = ActionList.show({
        title: `${displayName} · ${price}`,
        triggerPosition: { x: screenX, y: screenY },
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.perp_trade_limit }),
            onPress: (closeMenu) =>
              runAfterActionListClose(closeMenu, openLimit),
            testID: 'perps-chart-limit-order',
          },
          ...(instrument.mode === 'perp' && hasPosition()
            ? [
                {
                  label: intl.formatMessage({
                    id: ETranslations.perp_tp_sl_profit,
                  }),
                  onPress: (closeMenu: () => void) =>
                    runAfterActionListClose(closeMenu, () => openTpsl('tp')),
                  testID: 'perps-chart-take-profit',
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.perp_tp_sl_loss,
                  }),
                  onPress: (closeMenu: () => void) =>
                    runAfterActionListClose(closeMenu, () => openTpsl('sl')),
                  testID: 'perps-chart-stop-loss',
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
