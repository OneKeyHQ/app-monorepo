import type { ISearchBarProps } from '@onekeyhq/components';
import {
  SearchBar,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

type IProps = {
  searchProps?: ISearchBarProps & { searchResultCount?: number };
  headerRight?: React.ReactNode;
};
function ListToolToolBar({ searchProps, headerRight }: IProps) {
  const media = useMedia();

  if (!searchProps && !headerRight) return null;

  return (
    <YStack px="$5" py="$2" space="$5">
      <XStack alignItems="center" justifyContent="space-between">
        {searchProps && (
          <SearchBar
            placeholder="Search..."
            containerProps={{
              flex: 1,
            }}
            {...(media.gtMd && {
              size: 'small',
              containerProps: {
                maxWidth: '$60',
              },
            })}
            {...searchProps}
          />
        )}

        {headerRight && (
          <XStack flex={1} justifyContent="flex-end">
            {headerRight}
          </XStack>
        )}
      </XStack>
      {searchProps?.searchResultCount && searchProps?.searchResultCount > 0 ? (
        <SizableText
          color="$textSubdued"
          size="$bodyMdMedium"
        >{`${searchProps?.searchResultCount} 个搜索结果`}</SizableText>
      ) : null}
    </YStack>
  );
}

export { ListToolToolBar };
