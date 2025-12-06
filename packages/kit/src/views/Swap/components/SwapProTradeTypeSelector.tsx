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

import { useSwapProTokenSupportLimitAtom } from '../../../states/jotai/contexts/swap';

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
  const [swapProTokenSupportLimit] = useSwapProTokenSupportLimitAtom();
  const handleItemPress = (value: ESwapProTradeType) => {
    onSelectTradeType(value);
    setIsOpen(false);
  };

  return (
    <Popover
      title=""
      showHeader={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      renderTrigger={
        <XStack
          px="$3"
          cursor="pointer"
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
          <Icon
            w="$4"
            h="$4"
            name="ChevronDownSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      }
      renderContent={({ closePopover }) => (
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
                handleItemPress(item.value as ESwapProTradeType);
                closePopover();
              }}
              disabled={Boolean(
                item.value === ESwapProTradeType.LIMIT &&
                  !swapProTokenSupportLimit,
              )}
              alignItems="center"
              cursor="pointer"
              opacity={item.disabled ? 0.5 : 1}
            >
              {item.leading ? (
                <XStack pr="$3" alignItems="center">
                  {item.leading}
                </XStack>
              ) : null}
              <SizableText
                flex={1}
                size="$bodyMd"
                color={item.value === currentSelect ? '$text' : '$textSubdued'}
              >
                {item.label}
              </SizableText>
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
