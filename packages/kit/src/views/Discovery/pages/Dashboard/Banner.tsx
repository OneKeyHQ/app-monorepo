import { useCallback } from 'react';

import type { IRenderPaginationParams } from '@onekeyhq/components';
import {
  IconButton,
  Image,
  SizableText,
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
}: {
  banners: IDiscoveryBanner[];
  handleOpenWebSite: ({
    dApp,
    webSite,
    useSystemBrowser,
  }: IMatchDAppItemType & { useSystemBrowser: boolean }) => void;
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
        {media.gtMd && (
          <>
            {currentIndex !== 0 && (
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
            )}

            {currentIndex !== banners.length - 1 && (
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
            )}
          </>
        )}
        {banners.length > 1 && (
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
        )}
      </>
    ),
    [media.gtMd, banners],
  );

  const keyExtractor = useCallback(
    (item: IDiscoveryBanner) => item.bannerId,
    [],
  );

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
