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
import type { IStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../types';

const ICON_SIZE = 56;

// Phones: a tighter icon/label pairing, like a home-screen grid.
const CARD_FRAME_PROPS = {
  py: '$2',
  gap: '$3',
  '$platform-native': { py: '$1', gap: '$2' },
  justifyContent: 'center',
  alignItems: 'center',
  userSelect: 'none',
} as const satisfies IStackProps;
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
    // Web only: a long first word gets a manual break, since it would
    // overflow instead of wrapping. Native fits single words instead (below).
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

  // Native: a single long word shrinks onto one line rather than breaking.
  const fitSingleWord = platformEnv.isNative && !title.trim().includes(' ');

  const handlePress = useCallback(() => {
    handleOpenWebSite({
      dApp,
      webSite: { url, title, logo, sortIndex: undefined },
    });
  }, [handleOpenWebSite, dApp, url, title, logo]);

  if (isLoading) {
    return (
      <Stack {...CARD_FRAME_PROPS}>
        <Skeleton width={ICON_SIZE} height={ICON_SIZE} borderRadius="$4" />
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
      <Stack {...CARD_FRAME_PROPS}>
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
          px="$2"
          $platform-native={{ px: '$1.5' }}
          w="100%"
          size="$bodySmMedium"
          textAlign="center"
          numberOfLines={fitSingleWord ? 1 : 2}
          adjustsFontSizeToFit={fitSingleWord}
          minimumFontScale={0.8}
        >
          {displayTitle}
        </SizableText>
      </Stack>
    </TouchableOpacity>
  );
}
