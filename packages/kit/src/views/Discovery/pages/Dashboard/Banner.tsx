import { useCallback } from 'react';

import { isNil } from 'lodash';

import type { IRenderPaginationParams } from '@onekeyhq/components';
import {
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  Swiper,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../../types';

export function Banner({
  banners,
  handleOpenWebSite,
  isLoading,
}: {
  banners: IDiscoveryBanner[];
  handleOpenWebSite: ({
    dApp,
    webSite,
    useSystemBrowser,
  }: IMatchDAppItemType & { useSystemBrowser: boolean }) => void;
  isLoading: boolean | undefined;
}) {
  const media = useMedia();
  const renderItem = useCallback(
    ({ item }: { item: IDiscoveryBanner }) => (
      <Stack
        p="$5"
        tag="section"
        flex={1}
        position="relative"
        userSelect="none"
        onPress={() =>
          handleOpenWebSite({
            webSite: {
              url: item.href,
              title: item.href,
            },
            useSystemBrowser: item.useSystemBrowser,
          })
        }
      >
        <Image flex={1} borderRadius="$3" bg="$bgStrong" src={item.src} />
        <Stack
          position="absolute"
          bottom={0}
          right={0}
          left={0}
          px="$10"
          py="$8"
          $gtMd={{
            px: '$14',
            py: '$10',
          }}
        >
          <SizableText
            color={
              item.theme === 'light' ? '$neutral12Light' : '$neutral12Dark'
            }
            size="$headingLg"
            $gtMd={{
              size: '$heading2xl',
            }}
            maxWidth="$96"
          >
            {item.title ?? ''}
          </SizableText>
        </Stack>
      </Stack>
    ),
    [handleOpenWebSite],
  );

  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
    }: IRenderPaginationParams) => (
      <>
        {media.gtMd ? (
          <>
            {currentIndex !== 0 ? (
              <IconButton
                position="absolute"
                left="$10"
                top="50%"
                transform="translateY(-50%)"
                icon="ChevronLeftOutline"
                variant="tertiary"
                iconProps={{
                  color:
                    banners[currentIndex]?.theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={gotToPrevIndex}
              />
            ) : null}

            {currentIndex !== banners.length - 1 ? (
              <IconButton
                icon="ChevronRightOutline"
                variant="tertiary"
                position="absolute"
                right="$10"
                top="50%"
                transform="translateY(-50%)"
                iconProps={{
                  color:
                    banners[currentIndex]?.theme === 'light'
                      ? '$iconSubduedLight'
                      : '$iconSubduedDark',
                }}
                onPress={goToNextIndex}
                disabled={currentIndex === banners.length - 1}
              />
            ) : null}
          </>
        ) : null}
        {banners.length > 1 ? (
          <XStack space="$1" position="absolute" right="$10" bottom="$10">
            {banners.map((_, index) => (
              <Stack
                key={index}
                w="$3"
                $gtMd={{
                  w: '$4',
                }}
                h="$1"
                borderRadius="$full"
                bg="$whiteA12"
                opacity={currentIndex === index ? 1 : 0.5}
              />
            ))}
          </XStack>
        ) : null}
      </>
    ),
    [media.gtMd, banners],
  );

  const keyExtractor = useCallback(
    (item: IDiscoveryBanner) => item.bannerId,
    [],
  );

  if (isNil(isLoading) || isLoading) {
    return (
      <Stack p="$5">
        <Skeleton
          h={188}
          w="100%"
          $gtMd={{
            height: 268,
          }}
          $gtLg={{
            height: 364,
          }}
        />
      </Stack>
    );
  }

  return (
    <Swiper
      autoplay
      autoplayLoop
      autoplayLoopKeepAnimation
      autoplayDelayMs={3000}
      height={228}
      $gtMd={{
        height: 308,
      }}
      $gtLg={{
        height: 404,
      }}
      keyExtractor={keyExtractor}
      data={banners}
      renderItem={renderItem}
      renderPagination={renderPagination}
    />
  );
}
