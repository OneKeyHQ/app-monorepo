import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

interface ISwapProTradeTypeSelectorProps {
  selectItems: ISelectItem[];
  currentSelect: ESwapProTradeType;
  onSelectTradeType: (value: ESwapProTradeType) => void;
}

const SwapProTradeTypeSelector = ({
  selectItems,
  currentSelect,
  onSelectTradeType,
}: ISwapProTradeTypeSelectorProps) => {
  const intl = useIntl();
  return (
    <Select
      title=""
      items={selectItems}
      value={currentSelect}
      onChange={onSelectTradeType}
      renderTrigger={({ onPress }) => (
        <XStack
          px="$3"
          cursor="pointer"
          userSelect="none"
          borderRadius="$2"
          onPress={onPress}
          h="$8"
          alignItems="center"
          gap="$2"
          bg="$bgStrong"
          hoverStyle={{
            bg: '$bgStrongHover',
          }}
          pressStyle={{
            bg: '$bgStrongActive',
          }}
          focusStyle={{
            bg: '$bgStrongActive',
          }}
        >
          <SizableText flex={1} size="$bodyMd" textAlign="center">
            {intl.formatMessage({
              id:
                currentSelect === ESwapProTradeType.LIMIT
                  ? ETranslations.perp_trade_limit
                  : ETranslations.perp_trade_market,
            })}
          </SizableText>
          <Icon
            w="$4"
            h="$4"
            name="ChevronDownSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      )}
    />
  );
};

export default SwapProTradeTypeSelector;
