import { useIntl } from 'react-intl';

import type { ISearchBarProps, IYStackProps } from '@onekeyhq/components';
import { SearchBar, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  searchProps?: ISearchBarProps & { searchResultCount?: number };
  headerRight?: React.ReactNode;
} & IYStackProps;
function ListToolToolBar({ searchProps, headerRight, ...rest }: IProps) {
  const media = useMedia();
  const intl = useIntl();

  if (!searchProps && !headerRight) return null;

  return (
    <YStack px="$5" pb="$2" mt="$5" {...rest}>
      <XStack alignItems="center" justifyContent="space-between">
        {searchProps ? (
          <SearchBar
            placeholder={`${intl.formatMessage({
              id: ETranslations.global_search,
            })}...`}
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
        ) : null}

        {headerRight ? <XStack pl="$5">{headerRight}</XStack> : null}
      </XStack>
      {/* {searchProps?.searchResultCount && searchProps?.searchResultCount > 0 ? (
        <SizableText
          color="$textSubdued"
          size="$bodyMdMedium"
        >{`${searchProps?.searchResultCount} 个搜索结果`}</SizableText>
      ) : null} */}
    </YStack>
  );
}

export { ListToolToolBar };
