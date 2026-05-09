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
  logoSize?: '$14' | '$16';
  logoIconSize?: '$12' | '$14';
  logoBorderRadius?: '$3' | '$4';
  logoFullWidth?: boolean;
  contentPy?: '$1' | '$2';
  contentGap?: '$2' | '$3';
  titlePx?: '$0' | '$2';
  titleMx?: '$-2.5' | '$-3';
  maxTitleWordLength?: number;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}

export function DiscoveryItemCard({
  logo,
  title,
  url,
  dApp,
  isAd,
  isLoading,
  logoSize = '$14',
  logoIconSize = '$12',
  logoBorderRadius = '$3',
  logoFullWidth = false,
  contentPy = '$2',
  contentGap = '$3',
  titlePx = '$2',
  titleMx,
  maxTitleWordLength,
  handleOpenWebSite,
}: IDiscoveryItemCardProps) {
  const { md } = useMedia();
  const maxWordLength = useMemo(() => {
    if (maxTitleWordLength) {
      return maxTitleWordLength;
    }
    if (platformEnv.isNative) {
      return 9;
    }
    return md ? 9 : 16;
  }, [maxTitleWordLength, md]);
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
        width="100%"
        py={contentPy}
        gap={contentGap}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Stack
          width={logoFullWidth ? '100%' : logoSize}
          {...(logoFullWidth ? { aspectRatio: 1 } : { height: logoSize })}
        >
          <Skeleton
            width="100%"
            height="100%"
            borderRadius={logoBorderRadius}
          />
        </Stack>
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
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={{ width: '100%' }}
    >
      <Stack
        width="100%"
        py={contentPy}
        gap={contentGap}
        justifyContent="center"
        alignItems="center"
        userSelect="none"
      >
        <Stack
          width={logoFullWidth ? '100%' : logoSize}
          {...(logoFullWidth ? { aspectRatio: 1 } : { height: logoSize })}
          position="relative"
          borderRadius={logoBorderRadius}
          borderCurve="continuous"
          overflow="hidden"
        >
          <Image
            width="100%"
            height="100%"
            source={{ uri: logo }}
            fallback={
              <Image.Fallback>
                <Icon
                  size={logoIconSize}
                  color="$iconSubdued"
                  name="GlobusOutline"
                />
              </Image.Fallback>
            }
          />
          <InnerStroke borderRadius={logoBorderRadius} />
          {isAd ? <AdCornerBadge badgeSize="sm" /> : null}
        </Stack>
        <SizableText
          px={titlePx}
          {...(titleMx ? { alignSelf: 'stretch', mx: titleMx } : { w: '100%' })}
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
