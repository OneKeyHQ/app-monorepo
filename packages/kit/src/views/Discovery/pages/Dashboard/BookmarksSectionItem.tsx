import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
} from '@onekeyhq/components';

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
      justifyContent="center"
      alignItems="center"
      userSelect="none"
      onPress={() => handleOpenWebSite({ webSite: { url, title } })}
    >
      <Image
        size="$14"
        borderRadius="$3"
        $gtLg={{
          w: '$12',
          h: '$12',
        }}
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <Image.Source
          source={{
            uri: logo,
          }}
        />
        <Image.Fallback>
          <Icon
            size="$14"
            $gtLg={{
              size: '$12',
            }}
            name="GlobusOutline"
          />
        </Image.Fallback>
        <Image.Loading>
          <Skeleton width="100%" height="100%" />
        </Image.Loading>
      </Image>

      <SizableText
        size="$bodyLgMedium"
        px="$2"
        $gtMd={{
          size: '$bodyMdMedium',
          px: '$0',
        }}
        textAlign="center"
        numberOfLines={1}
      >
        {title}
      </SizableText>
    </Stack>
  );
}
