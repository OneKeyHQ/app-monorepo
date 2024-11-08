import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  EPortalContainerConstantName,
  Heading,
  Icon,
  Image,
  Portal,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import SidebarBannerImage from '@onekeyhq/kit/assets/sidebar-banner.png';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { GestureResponderEvent } from 'react-native';

function BasicSidebarBanner() {
  const intl = useIntl();
  const { isFirstVisit, tourVisited } = useSpotlight(
    ESpotlightTour.oneKeyProBanner,
  );

  const openUrl = useCallback(() => {
    openUrlExternal('https://bit.ly/3LNVKAT');
  }, []);

  const onTourVisited = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void tourVisited();
    },
    [tourVisited],
  );

  return isFirstVisit ? (
    <Stack
      mt="$2"
      borderRadius="$2"
      borderCurve="continuous"
      bg="$bgStrong"
      overflow="hidden"
      userSelect="none"
      hoverStyle={{
        bg: '$gray6',
      }}
      pressStyle={{
        bg: '$gray7',
      }}
      onPress={openUrl}
    >
      <Stack>
        <Image h={103} source={SidebarBannerImage} />
        <Stack
          position="absolute"
          top="$2"
          right="$2"
          bg="$whiteA3"
          borderRadius="$full"
          hoverStyle={{
            bg: '$whiteA4',
          }}
          pressStyle={{
            bg: '$whiteA5',
          }}
          onPress={onTourVisited}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$whiteA7" />
        </Stack>
      </Stack>
      <Stack px="$3" py="$2.5">
        <Heading size="$bodySmMedium" pb="$0.5">
          OneKey Pro
        </Heading>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.hw_banner_description })}
        </SizableText>
      </Stack>
    </Stack>
  ) : null;
}

export const SidebarBanner = () => {
  const { gtMd } = useMedia();
  return gtMd ? (
    <Portal.Body container={EPortalContainerConstantName.SIDEBAR_BANNER}>
      <BasicSidebarBanner />
    </Portal.Body>
  ) : null;
};
