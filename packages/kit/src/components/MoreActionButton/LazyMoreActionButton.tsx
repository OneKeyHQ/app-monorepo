import type { ComponentType } from 'react';

import { HeaderIconButton } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

function MoreActionButtonFallback() {
  return <HeaderIconButton icon="DotGridOutline" />;
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
