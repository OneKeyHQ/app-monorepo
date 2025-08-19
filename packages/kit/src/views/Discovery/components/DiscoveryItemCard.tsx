import { useMemo } from 'react';

import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
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
  isLoading?: boolean;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}

export function DiscoveryItemCard({
  logo,
  title,
  url,
  dApp,
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

  return (
    <Stack
      py="$2"
      gap="$3"
      justifyContent="center"
      alignItems="center"
      userSelect="none"
      onPress={() =>
        handleOpenWebSite({
          dApp,
          webSite: { url, title, logo, sortIndex: undefined },
        })
      }
    >
      <Image
        size="$14"
        position="relative"
        borderRadius="$3"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        source={{ uri: logo }}
        fallback={
          <Image.Fallback>
            <Icon size="$12" color="$iconSubdued" name="GlobusOutline" />
          </Image.Fallback>
        }
      />
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
  );
}
