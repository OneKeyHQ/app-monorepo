import { useCallback } from 'react';

import { Button, XStack } from '@onekeyhq/components';

import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';

interface IFeaturedTabBarProps {
  features: IFeaturedItem[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

function FeaturedTabBar({
  features,
  activeIndex,
  onTabPress,
}: IFeaturedTabBarProps) {
  const handlePress = useCallback(
    (index: number) => () => {
      onTabPress(index);
    },
    [onTabPress],
  );

  if (features.length <= 1) {
    return null;
  }

  return (
    <XStack gap="$2" flexWrap="wrap" mb="$3">
      {features.map((feature, index) => (
        <Button
          key={index}
          size="small"
          variant={index === activeIndex ? 'primary' : 'secondary'}
          borderRadius="$full"
          onPress={handlePress(index)}
        >
          {feature.tabLabel}
        </Button>
      ))}
    </XStack>
  );
}

export { FeaturedTabBar };
