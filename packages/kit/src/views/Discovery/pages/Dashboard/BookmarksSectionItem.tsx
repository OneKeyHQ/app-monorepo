import { StyleSheet } from 'react-native';

import { Icon, Image, SizableText, Stack } from '@onekeyhq/components';

import type { IMatchDAppItemType } from '../../types';

export function BookmarksSectionItem({
  logo,
  title,
  url,
  handleOpenWebSite,
}: {
  logo?: string;
  title: string;
  url: string;
  handleOpenWebSite: ({ dApp, webSite }: IMatchDAppItemType) => void;
}) {
  return (
    <Stack
      py="$2"
      gap="$3"
      justifyContent="center"
      alignItems="center"
      userSelect="none"
      onPress={() => handleOpenWebSite({ webSite: { url, title } })}
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
          <Icon size="$14" name="GlobusOutline" />
        </Image.Fallback>
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
