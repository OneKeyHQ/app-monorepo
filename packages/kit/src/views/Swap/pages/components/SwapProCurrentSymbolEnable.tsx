import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SwapProCurrentSymbolEnable = () => {
  const [swapProEnableCurrentSymbol, setSwapProEnableCurrentSymbol] =
    useSwapProEnableCurrentSymbolAtom();
  const intl = useIntl();
  return (
    <XStack
      gap="$2"
      alignItems="center"
      mt="$2"
      onPress={() => setSwapProEnableCurrentSymbol(!swapProEnableCurrentSymbol)}
      cursor="pointer"
    >
      <Checkbox value={swapProEnableCurrentSymbol} />
      <SizableText>
        {intl.formatMessage({ id: ETranslations.dexmarket_pro_current_symbol })}
      </SizableText>
    </XStack>
  );
};
export default SwapProCurrentSymbolEnable;
