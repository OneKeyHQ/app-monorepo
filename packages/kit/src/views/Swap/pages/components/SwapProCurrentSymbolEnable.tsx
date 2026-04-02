import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwapProCurrentSymbolEnableProps {
  isFocusSwapPro?: boolean;
}

const SwapProCurrentSymbolEnable = ({
  isFocusSwapPro = true,
}: ISwapProCurrentSymbolEnableProps) => {
  const [swapProEnableCurrentSymbol, setSwapProEnableCurrentSymbol] =
    useSwapProEnableCurrentSymbolAtom();
  const intl = useIntl();
  const toggleSwapProEnableCurrentSymbol = useCallback(() => {
    setSwapProEnableCurrentSymbol((prev) => !prev);
  }, [setSwapProEnableCurrentSymbol]);
  return (
    <XStack
      gap="$2"
      alignItems="center"
      mt="$2"
      onPress={toggleSwapProEnableCurrentSymbol}
      cursor="pointer"
    >
      <Checkbox
        value={swapProEnableCurrentSymbol}
        onChange={toggleSwapProEnableCurrentSymbol}
      />
      <SizableText>
        {intl.formatMessage({
          id: isFocusSwapPro
            ? ETranslations.dexmarket_pro_current_symbol
            : ETranslations.swap_current_token,
        })}
      </SizableText>
    </XStack>
  );
};
export default SwapProCurrentSymbolEnable;
