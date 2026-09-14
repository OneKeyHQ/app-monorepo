import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ESwapProAnalyticsTab } from '@onekeyhq/shared/types/swap/types';

interface ISwapProCurrentSymbolEnableProps {
  isStock?: boolean;
  analyticsTab?: ESwapProAnalyticsTab;
}

const SwapProCurrentSymbolEnable = ({
  isStock,
  analyticsTab,
}: ISwapProCurrentSymbolEnableProps) => {
  const [swapProEnableCurrentSymbol, setSwapProEnableCurrentSymbol] =
    useSwapProEnableCurrentSymbolAtom();
  const intl = useIntl();
  const toggleSwapProEnableCurrentSymbol = useCallback(() => {
    const enabled = !swapProEnableCurrentSymbol;
    setSwapProEnableCurrentSymbol(enabled);
    if (analyticsTab) {
      defaultLogger.swap.swapPro.swapProCurrentSymbolToggle({
        enabled,
        tab: analyticsTab,
      });
    }
  }, [analyticsTab, setSwapProEnableCurrentSymbol, swapProEnableCurrentSymbol]);
  // Swap & Bridge and Pro share the same "Current tokens" label; only the Stock
  // tab uses its own "Current stock".
  const labelId = isStock
    ? ETranslations.stocks_current_stock
    : ETranslations.swap_current_token;
  return (
    <XStack
      gap="$2"
      alignItems="center"
      mt="$2"
      onPress={toggleSwapProEnableCurrentSymbol}
      cursor="pointer"
    >
      <Checkbox
        testID="swap-toggle-swap-pro-enable-current-symbol-checkbox"
        value={swapProEnableCurrentSymbol}
        onChange={toggleSwapProEnableCurrentSymbol}
        shouldStopPropagation
      />
      <SizableText>{intl.formatMessage({ id: labelId })}</SizableText>
    </XStack>
  );
};
export default SwapProCurrentSymbolEnable;
