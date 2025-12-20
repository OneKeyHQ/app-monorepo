import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SwapProCurrentSymbolEnable = () => {
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
        {intl.formatMessage({ id: ETranslations.dexmarket_pro_current_symbol })}
      </SizableText>
    </XStack>
  );
};
export default SwapProCurrentSymbolEnable;
