import { useState } from 'react';

import { ButtonFrame } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { GetProps } from 'tamagui';

export interface IHeaderNavigationItem {
  key: string;
  label: string;
  onPress?: () => void;
}

export interface IHeaderNavigationProps extends GetProps<typeof XStack> {
  items: IHeaderNavigationItem[];
  activeKey?: string | null;
  onTabChange?: (key: string) => void;
}

export function HeaderNavigation({
  items,
  activeKey: controlledActiveKey,
  onTabChange,
  ...rest
}: IHeaderNavigationProps) {
  const [internalActiveKey, setInternalActiveKey] = useState(items[0]?.key);
  // If controlledActiveKey is null, no item should be active (controlled mode)
  // If controlledActiveKey is undefined, use internal state (uncontrolled mode)
  const activeKey =
    controlledActiveKey === null
      ? null
      : controlledActiveKey ?? internalActiveKey;

  const handleTabPress = (item: IHeaderNavigationItem) => {
    if (controlledActiveKey === undefined) {
      setInternalActiveKey(item.key);
    }
    if (onTabChange) {
      onTabChange(item.key);
    }
    if (item.onPress) {
      item.onPress();
    }
  };

  return (
    <XStack gap="$1" alignItems="center" testID="Header-Navigation" {...rest}>
      {items.map((item) => {
        const isActive = activeKey !== null && item.key === activeKey;
        return (
          <ButtonFrame
            key={item.key}
            py="$1"
            px="$2"
            bg="$transparent"
            borderWidth="$0"
            borderRadius="$2"
            cursor="pointer"
            onPress={() => handleTabPress(item)}
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusable
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
          >
            <SizableText
              size="$bodyMd"
              fontWeight="500"
              color={isActive ? '$text' : '$textSubdued'}
              userSelect="none"
            >
              {item.label}
            </SizableText>
          </ButtonFrame>
        );
      })}
    </XStack>
  );
}

export default HeaderNavigation;
