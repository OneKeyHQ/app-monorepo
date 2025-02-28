import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
} from '@onekeyhq/components';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import type { IMatchDAppItemType } from '../types';

export interface IDiscoveryItemCardProps {
  logo?: string;
  title: string;
  url: string;
  dApp?: IDApp;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}

export function DiscoveryItemCard({
  logo,
  title,
  url,
  dApp,
  handleOpenWebSite,
}: IDiscoveryItemCardProps) {
  return (
    <Stack
      py="$2"
      gap="$3"
      justifyContent="center"
      alignItems="center"
      userSelect="none"
      onPress={() => handleOpenWebSite({ dApp, webSite: { url, title } })}
    >
      <Image
        size="$14"
        position="relative"
        borderRadius="$3"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <Image.Source source={{ uri: logo }} />
        <Image.Fallback>
          <Icon size="$14" color="$iconSubdued" name="GlobusOutline" />
        </Image.Fallback>
        <Image.Loading>
          <Skeleton width="$14" height="$14" />
        </Image.Loading>
      </Image>

      <SizableText
        px="$2"
        size="$bodyLgMedium"
        textAlign="center"
        numberOfLines={1}
      >
        {title}
      </SizableText>
    </Stack>
  );
}
