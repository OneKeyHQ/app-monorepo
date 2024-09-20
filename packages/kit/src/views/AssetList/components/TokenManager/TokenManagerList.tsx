import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Empty,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ICustomTokenItem } from '@onekeyhq/shared/types/token';

function ListHeaderComponent({
  onAddCustomToken,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();

  return (
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.manage_token_custom_token_title,
      })}
      drillIn
      onPress={onAddCustomToken}
    />
  );
}

function ListEmptyComponent({
  onAddCustomToken,
  isLoading,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
  isLoading: boolean;
}) {
  const intl = useIntl();
  if (isLoading) {
    return null;
  }
  return (
    <Empty
      flex={1}
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
      description={intl.formatMessage({
        id: ETranslations.manage_token_empty_msg,
      })}
      button={
        <Button
          mt="$6"
          size="medium"
          variant="primary"
          onPress={() => onAddCustomToken()}
        >
          {intl.formatMessage({
            id: ETranslations.manage_token_custom_token_button,
          })}
        </Button>
      }
    />
  );
}

function ListFooterComponent({
  searchValue,
  searchResult,
  onAddCustomToken,
}: {
  searchValue: string;
  searchResult: ICustomTokenItem[] | null;
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();

  if (
    searchValue.length &&
    Array.isArray(searchResult) &&
    searchResult.length
  ) {
    return (
      <>
        <Divider pt="$5" />
        <YStack p="$5" alignItems="center">
          <SizableText
            textAlign="center"
            size="$bodyMd"
            maxWidth={platformEnv.isNative ? 256 : undefined}
          >
            {intl.formatMessage({
              id: ETranslations.manage_token_empty_msg,
            })}
          </SizableText>
          <Button
            mt="$6"
            size="medium"
            variant="primary"
            onPress={() => onAddCustomToken()}
          >
            {intl.formatMessage({
              id: ETranslations.manage_token_custom_token_button,
            })}
          </Button>
        </YStack>
      </>
    );
  }

  return null;
}

function SkeletonList() {
  return Array.from({ length: 5 }).map((_, index) => (
    <ListItem key={index}>
      <XStack alignItems="center" gap="$3">
        <Skeleton width="$10" height="$10" radius="round" />
        <YStack gap="$2">
          <Skeleton w={120} h={12} borderRadius="$3" />
          <Skeleton w={80} h={12} borderRadius="$3" />
        </YStack>
      </XStack>
    </ListItem>
  ));
}

function TokenManagerList({
  dataSource,
  onAddCustomToken,
  onHiddenToken,
  isLoadingRemoteData,
  isLoadingLocalData,
  networkId,
  isAllNetwork,
  networkMaps,
  checkTokenExistInTokenList,
  searchValue,
  searchResult,
  showListHeader = true,
}: {
  dataSource:
    | {
        title: string;
        data: ICustomTokenItem[];
      }[]
    | undefined;
  onAddCustomToken: (token?: ICustomTokenItem) => void;
  onHiddenToken: (token: ICustomTokenItem) => Promise<void>;
  isLoadingRemoteData: boolean;
  isLoadingLocalData?: boolean;
  networkId: string;
  isAllNetwork: boolean;
  networkMaps: Record<string, IServerNetwork>;
  checkTokenExistInTokenList: (
    token: ICustomTokenItem,
  ) => ICustomTokenItem | undefined;
  searchValue: string;
  searchResult: ICustomTokenItem[] | null;
  showListHeader?: boolean;
}) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  if (isLoadingRemoteData || !dataSource) {
    return <SkeletonList />;
  }
  return (
    <SectionList
      ListHeaderComponent={
        showListHeader ? (
          <ListHeaderComponent onAddCustomToken={onAddCustomToken} />
        ) : null
      }
      sections={dataSource}
      estimatedItemSize={60}
      renderSectionHeader={({ section: { title, data } }) => (
        <>
          <SizableText mt={10} px="$5" size="$bodyMd" color="$textSubdued">
            {title}
          </SizableText>
          {Array.isArray(data) && !data.length ? (
            <ListEmptyComponent
              onAddCustomToken={onAddCustomToken}
              isLoading={isLoadingRemoteData || !!isLoadingLocalData}
            />
          ) : null}
        </>
      )}
      keyExtractor={(item) => (item as ICustomTokenItem).$key}
      renderItem={({ item }: { item: ICustomTokenItem }) => (
        <ListItem>
          <TokenIconView
            icon={item.logoURI}
            networkId={item.networkId ?? networkId}
            isAllNetworks
          />
          <YStack flex={1}>
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyLgMedium" color="$text">
                {item.symbol}
              </SizableText>
              {isAllNetwork ? (
                <Badge>{networkMaps?.[item.networkId ?? '']?.name ?? ''}</Badge>
              ) : null}
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {item.name}
            </SizableText>
          </YStack>
          <ListItem.IconButton
            disabled={
              !!(
                checkTokenExistInTokenList(item) &&
                networkUtils.isBTCNetwork(item.networkId)
              )
            }
            title={
              checkTokenExistInTokenList(item) &&
              networkUtils.isBTCNetwork(item.networkId)
                ? intl.formatMessage({
                    id: ETranslations.manage_token_native_token_cannot_removed,
                  })
                : undefined
            }
            icon={
              checkTokenExistInTokenList(item)
                ? 'MinusCircleOutline'
                : 'PlusCircleOutline'
            }
            onPress={() =>
              checkTokenExistInTokenList(item)
                ? onHiddenToken(item)
                : onAddCustomToken(item)
            }
            {...(checkTokenExistInTokenList(item) && {
              iconProps: {
                color: '$iconCritical',
              },
            })}
          />
        </ListItem>
      )}
      ListFooterComponent={
        <>
          <ListFooterComponent
            searchValue={searchValue}
            searchResult={searchResult}
            onAddCustomToken={onAddCustomToken}
          />
          <Stack h={bottom || '$3'} />
        </>
      }
      ListEmptyComponent={
        <ListEmptyComponent
          onAddCustomToken={onAddCustomToken}
          isLoading={isLoadingRemoteData || !!isLoadingLocalData}
        />
      }
      keyboardDismissMode="on-drag"
    />
  );
}

export { TokenManagerList };
