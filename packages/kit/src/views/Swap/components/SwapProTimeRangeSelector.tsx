import { useState } from 'react';

import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { defaultTimeRangeItem } from '../../../states/jotai/contexts/swap';

interface ISwapProTimeRangeSelectorProps {
  items: { label: string; value: ESwapProTimeRange }[];
  selectedValue: { label: string; value: ESwapProTimeRange };
  onChange: (value: ESwapProTimeRange) => void;
  isNative?: boolean;
}

const SwapProTimeRangeSelector = ({
  items,
  selectedValue,
  onChange,
  isNative,
}: ISwapProTimeRangeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleItemPress = (value: ESwapProTimeRange) => {
    onChange(value);
    setIsOpen(false);
  };

  return (
    <Popover
      title=""
      showHeader={false}
      open={isOpen}
      onOpenChange={(open) => {
        if (isNative) {
          return;
        }
        setIsOpen(open);
      }}
      renderTrigger={
        <XStack
          px="$3"
          cursor="pointer"
          userSelect="none"
          borderRadius="$2"
          onPress={() => setIsOpen((prev) => !prev)}
          h="$8"
          alignItems="center"
          justifyContent="space-between"
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
          <SizableText size="$bodyMd">
            {isNative ? defaultTimeRangeItem.label : selectedValue.label}
          </SizableText>
          {isNative ? null : (
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          )}
        </XStack>
      }
      renderContent={({ closePopover }) => (
        <YStack $md={{ p: '$3' }}>
          {items.map((item) => (
            <XStack
              key={item.value}
              px="$2"
              py="$1.5"
              borderRadius="$2"
              $md={{
                py: '$2.5',
                borderRadius: '$3',
              }}
              bg={item.value === selectedValue.value ? '$bgActive' : '$bg'}
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              onPress={() => {
                handleItemPress(item.value);
              }}
              alignItems="center"
              cursor="pointer"
            >
              <SizableText
                size="$bodyMd"
                color={
                  item.value === selectedValue.value ? '$text' : '$textSubdued'
                }
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

export default SwapProTimeRangeSelector;
