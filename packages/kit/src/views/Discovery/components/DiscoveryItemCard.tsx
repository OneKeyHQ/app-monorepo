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

const ICON_SIZE = 56;
const ICON_RADIUS = 12;

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

  const isSingleWord = !title.trim().includes(' ');

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
        $platform-native={{ py: '$1', gap: '$2' }}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Skeleton
          width={ICON_SIZE}
          height={ICON_SIZE}
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
        $platform-native={{ py: '$1', gap: '$2' }}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Stack
          width={ICON_SIZE}
          height={ICON_SIZE}
          position="relative"
          borderRadius={ICON_RADIUS}
          borderCurve="continuous"
          overflow="hidden"
        >
          <Image
            width="100%"
            height="100%"
            resizeWidth={ICON_SIZE}
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
          // Side padding keeps neighboring names apart. Multi-word names wrap
          // at spaces; a single long word ("PancakeSwap") shrinks a little to
          // stay on one line instead of breaking mid-word.
          px="$1.5"
          w="100%"
          size="$bodySmMedium"
          textAlign="center"
          numberOfLines={isSingleWord ? 1 : 2}
          adjustsFontSizeToFit={platformEnv.isNative && isSingleWord}
          minimumFontScale={0.8}
        >
          {displayTitle}
        </SizableText>
      </Stack>
    </TouchableOpacity>
  );
}
