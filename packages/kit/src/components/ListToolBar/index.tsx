import type { ISearchBarProps } from '@onekeyhq/components';
import { SearchBar, XStack, useMedia } from '@onekeyhq/components';

type IProps = {
  searchProps?: ISearchBarProps;
  headerRight?: React.ReactNode;
};
function ListToolToolBar({ searchProps, headerRight }: IProps) {
  const media = useMedia();

  if (!searchProps && !headerRight) return null;

  return (
    <XStack px="$5" py="$2" space="$5" alignItems="center">
      {searchProps && (
        <SearchBar
          placeholder="Search..."
          containerProps={{
            flex: 1,
          }}
          {...(media.gtMd && {
            size: 'small',
            maxWidth: '$60',
          })}
          {...searchProps}
        />
      )}
      {headerRight && headerRight}
    </XStack>
  );
}

export { ListToolToolBar };
