import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type {
  ISelectItem,
  ISelectRenderTriggerProps,
} from '@onekeyhq/components';
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

  const renderTrigger = useCallback(
    (props: ISelectRenderTriggerProps) => (
      <XStack
        pl="$3"
        pr="$2"
        userSelect="none"
        borderRadius="$2"
        onPress={props.onPress}
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
        <Icon size="$4" name="ChevronDownSmallOutline" color="$iconSubdued" />
      </XStack>
    ),
    [currentSelect, intl],
  );

  return (
    <Select
      items={selectItems}
      value={currentSelect}
      onChange={(value) => {
        onSelectTradeType(value as ESwapProTradeType);
      }}
      title={intl.formatMessage({ id: ETranslations.perp_trade_order_type })}
      renderTrigger={renderTrigger}
      floatingPanelProps={{
        width: '$56',
      }}
    />
  );
};

export default SwapProTradeTypeSelector;
