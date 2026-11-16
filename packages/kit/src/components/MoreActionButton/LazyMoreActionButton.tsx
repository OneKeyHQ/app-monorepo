import type { ComponentType } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderIconButton,
  Icon,
  XStack,
  YStack,
  rootNavigationRef,
  useIsDesktopModeUIInTabPages,
} from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import {
  EActionCenterPages,
  EFullScreenPushRoutes,
} from '@onekeyhq/shared/src/routes/fullScreenPush';

function handleMoreActionPage() {
  rootNavigationRef.current?.navigate(ERootRoutes.FullScreenPush, {
    screen: EFullScreenPushRoutes.ActionCenter,
    params: {
      screen: EActionCenterPages.ActionCenter,
    },
  });
}

function MoreActionButtonFallback() {
  const intl = useIntl();
  const isDesktopMode = useIsDesktopModeUIInTabPages();

  if (isDesktopMode) {
    return (
      <YStack p="$2">
        <Icon name="DotGridOutline" size="$6" color="$iconSubdued" />
      </YStack>
    );
  }

  const label = intl.formatMessage({ id: ETranslations.explore_options });

  return (
    <XStack>
      <HeaderIconButton
        testID="moreActions"
        onPress={handleMoreActionPage}
        title={label}
        accessibilityLabel={label}
        icon="DotGridOutline"
      />
    </XStack>
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
