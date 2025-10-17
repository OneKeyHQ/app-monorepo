import { useState } from 'react';

import { Button, XStack } from '@onekeyhq/components/src/primitives';

import type { GetProps } from 'tamagui';

export interface IHeaderNavigationItem {
  key: string;
  label: string;
  onPress?: () => void;
}

export interface IHeaderNavigationProps extends GetProps<typeof XStack> {
  items: IHeaderNavigationItem[];
  activeKey?: string;
  onTabChange?: (key: string) => void;
}

export function HeaderNavigation({
  items,
  activeKey: controlledActiveKey,
  onTabChange,
  ...rest
}: IHeaderNavigationProps) {
  const [internalActiveKey, setInternalActiveKey] = useState(items[0]?.key);
  const activeKey = controlledActiveKey ?? internalActiveKey;

  const handleTabPress = (item: IHeaderNavigationItem) => {
    if (!controlledActiveKey) {
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
    <XStack gap="$2" alignItems="center" testID="Header-Navigation" {...rest}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Button
            key={item.key}
            variant="tertiary"
            size="medium"
            onPress={() => handleTabPress(item)}
            {...(isActive && {
              backgroundColor: '$bgActive',
            })}
          >
            {item.label}
          </Button>
        );
      })}
    </XStack>
  );
}

export default HeaderNavigation;
