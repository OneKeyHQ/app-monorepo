import type { ComponentType } from 'react';

import { Icon, YStack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

function MoreActionButtonFallback() {
  return (
    <YStack p="$2">
      <Icon name="DotGridOutline" size="$6" color="$iconSubdued" />
    </YStack>
  );
}

export const LazyMoreActionButton = LazyLoad(
  async () => {
    const { MoreActionButton } = await import('./index');
    return {
      default: MoreActionButton as ComponentType<Record<string, unknown>>,
    };
  },
  undefined,
  <MoreActionButtonFallback />,
);
