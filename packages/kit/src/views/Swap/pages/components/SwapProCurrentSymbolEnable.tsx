import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapProCurrentSymbolEnableProps {
  isFocusSwapPro?: boolean;
  isStock?: boolean;
}

const SwapProCurrentSymbolEnable = ({
  isFocusSwapPro = true,
  isStock,
}: ISwapProCurrentSymbolEnableProps) => {
  const [swapProEnableCurrentSymbol, setSwapProEnableCurrentSymbol] =
    useSwapProEnableCurrentSymbolAtom();
  const intl = useIntl();
  const toggleSwapProEnableCurrentSymbol = useCallback(() => {
    setSwapProEnableCurrentSymbol((prev) => !prev);
  }, [setSwapProEnableCurrentSymbol]);
  let labelId = ETranslations.swap_current_token;
  if (isStock) {
    labelId = ETranslations.stocks_current_stock;
  } else if (isFocusSwapPro) {
    labelId = ETranslations.dexmarket_pro_current_symbol;
  }
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
