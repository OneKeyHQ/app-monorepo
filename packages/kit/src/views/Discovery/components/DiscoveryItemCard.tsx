import { useCallback, useMemo } from 'react';

import { TouchableOpacity } from 'react-native';

import {
  AdCornerBadge,
  Icon,
  Image,
  InnerStroke,
  SizableText,
  Skeleton,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../types';

// Phones: a larger icon, so the edge-aligned 4-column grid keeps an even,
// home-screen-like gap between icons instead of spreading them apart.
export const DISCOVERY_ITEM_ICON_SIZE = platformEnv.isNative ? 64 : 56;
const ICON_RADIUS = platformEnv.isNative ? 14 : 12;
// Lets the outer labels pass their icon by 12pt at most (the grid aligns
// outer icons with the page edge); longer names wrap to a second line.
const NATIVE_LABEL_MAX_WIDTH = DISCOVERY_ITEM_ICON_SIZE + 24;

export interface IDiscoveryItemCardProps {
  logo?: string;
  title: string;
  url: string;
  dApp?: IDApp;
  isAd?: boolean;
  isLoading?: boolean;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}

export function DiscoveryItemCard({
  logo,
  title,
  url,
  dApp,
  isAd,
  isLoading,
  handleOpenWebSite,
}: IDiscoveryItemCardProps) {
  const { md } = useMedia();
  const maxWordLength = md ? 9 : 16;
  const displayTitle = useMemo(() => {
    // Native wraps long names on its own (no forced hyphen); the manual
    // break is only for web, where a long word would overflow instead.
    if (platformEnv.isNative) {
      return title;
    }
    const words = title.split(' ');
    if (words[0].length > maxWordLength) {
      words[0] = `${words[0].slice(0, maxWordLength)}-\n${words[0].slice(
        maxWordLength,
      )} ${words.slice(1).join(' ')}`;
      return words.join(' ');
    }
    return title;
  }, [title, maxWordLength]);

  const handlePress = useCallback(() => {
    handleOpenWebSite({
      dApp,
      webSite: { url, title, logo, sortIndex: undefined },
    });
  }, [handleOpenWebSite, dApp, url, title, logo]);

  if (isLoading) {
    return (
      <Stack
        py="$2"
        gap="$3"
        // Phones: a tighter icon/label pairing, like a home-screen grid.
        $platform-native={{ py: '$1', gap: '$1.5' }}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Skeleton
          width={DISCOVERY_ITEM_ICON_SIZE}
          height={DISCOVERY_ITEM_ICON_SIZE}
          borderRadius={ICON_RADIUS}
        />
        <Skeleton
          width="$18"
          $gtMd={{
            width: '$20',
          }}
          height="$4"
          borderRadius="$1"
        />
      </Stack>
    );
  }

  // Use TouchableOpacity to fix iOS bug where setTimeout cannot be triggered
  // through components other than Button or TouchableOpacity after hidden views are restored.
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Stack
        py="$2"
        gap="$3"
        // Phones: a tighter icon/label pairing, like a home-screen grid.
        $platform-native={{ py: '$1', gap: '$1.5' }}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Stack
          width={DISCOVERY_ITEM_ICON_SIZE}
          height={DISCOVERY_ITEM_ICON_SIZE}
          position="relative"
          borderRadius={ICON_RADIUS}
          borderCurve="continuous"
          overflow="hidden"
        >
          <Image
            width="100%"
            height="100%"
            resizeWidth={DISCOVERY_ITEM_ICON_SIZE}
            source={{ uri: logo }}
            fallback={
              <Image.Fallback>
                <Icon size="$12" color="$iconSubdued" name="GlobusOutline" />
              </Image.Fallback>
            }
          />
          <InnerStroke borderRadius={ICON_RADIUS} />
          {isAd ? (
            <AdCornerBadge badgeSize="sm" placement="bottom-right" />
          ) : null}
        </Stack>
        <SizableText
          px="$1"
          w="100%"
          maxWidth={platformEnv.isNative ? NATIVE_LABEL_MAX_WIDTH : undefined}
          size="$bodySmMedium"
          textAlign="center"
          numberOfLines={2}
        >
          {displayTitle}
        </SizableText>
      </Stack>
    </TouchableOpacity>
  );
}
