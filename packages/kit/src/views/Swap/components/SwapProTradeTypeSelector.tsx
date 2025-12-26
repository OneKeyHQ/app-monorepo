import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
  const [isOpen, setIsOpen] = useState(false);
  const handleItemPress = (value: ESwapProTradeType) => {
    setIsOpen(false);
    setTimeout(() => {
      onSelectTradeType(value);
    }, 100);
  };

  return (
    <Popover
      title=""
      showHeader={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={
        <XStack
          pl="$3"
          pr="$2"
          userSelect="none"
          borderRadius="$2"
          onPress={() => setIsOpen(true)}
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
      }
      renderContent={() => (
        <YStack $md={{ p: '$3' }} gap="$2">
          {selectItems.map((item) => (
            <XStack
              key={String(item.value)}
              px="$2"
              py="$1.5"
              borderRadius="$2"
              $md={{
                py: '$2.5',
                borderRadius: '$3',
              }}
              bg={item.value === currentSelect ? '$bgActive' : '$bg'}
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              onPress={() => {
                if (item.disabled) {
                  return;
                }
                handleItemPress(item.value as ESwapProTradeType);
              }}
              disabled={item.disabled}
              alignItems="center"
              justifyContent="space-between"
              cursor="pointer"
              opacity={item.disabled ? 0.5 : 1}
            >
              <XStack alignItems="center" gap="$1">
                {item.leading ? (
                  <XStack pr="$3" alignItems="center">
                    {item.leading}
                  </XStack>
                ) : null}
                <YStack gap="$1">
                  <SizableText flex={1} size="$bodyMd">
                    {item.label}
                  </SizableText>
                  {item.description ? (
                    <SizableText size="$bodySm" color="$textSubdued">
                      {item.description}
                    </SizableText>
                  ) : null}
                </YStack>
              </XStack>
              {item.value === currentSelect ? (
                <Icon name="CheckRadioSolid" size="$6" color="$iconActive" />
              ) : null}
            </XStack>
          ))}
        </YStack>
      )}
      floatingPanelProps={{
        width: '$56',
      }}
    />
  );
};

export default SwapProTradeTypeSelector;
