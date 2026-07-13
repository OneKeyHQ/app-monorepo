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
  const maxWordLength = useMemo(() => {
    if (platformEnv.isNative) {
      return 9;
    }
    return md ? 9 : 16;
  }, [md]);
  const displayTitle = useMemo(() => {
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
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Skeleton width="$14" height="$14" borderRadius="$4" />
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
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Stack
          width="$14"
          height="$14"
          position="relative"
          borderRadius="$3"
          borderCurve="continuous"
          overflow="hidden"
        >
          <Image
            width="100%"
            height="100%"
            source={{ uri: logo }}
            fallback={
              <Image.Fallback>
                <Icon size="$12" color="$iconSubdued" name="GlobusOutline" />
              </Image.Fallback>
            }
          />
          <InnerStroke borderRadius="$3" />
          {isAd ? (
            <AdCornerBadge badgeSize="sm" placement="bottom-right" />
          ) : null}
        </Stack>
        <SizableText
          px="$2"
          w="100%"
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
