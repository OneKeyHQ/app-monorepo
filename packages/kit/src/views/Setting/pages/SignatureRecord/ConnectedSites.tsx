import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  Icon,
  Image,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IConnectedSite } from '@onekeyhq/shared/types/signatureRecord';

import { SETTINGS_PAGE_CONTENT_PADDING_X } from '../Tab/settingsSurface';

import { useGetSignatureSections } from './hooks';

const getConnectedSiteTitle = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const ConnectedSiteItem = ({ item }: { item: IConnectedSite }) => (
  <Stack px={SETTINGS_PAGE_CONTENT_PADDING_X} pb="$3">
    <YStack
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$3"
      borderColor="$borderSubdued"
      overflow="hidden"
    >
      <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
        <SizableText size="$bodyMd">
          {formatTime(new Date(item.createdAt), { hideSeconds: true })}
        </SizableText>
      </XStack>
      <XStack p="$3" alignItems="center">
        <Image
          borderRadius="$full"
          overflow="hidden"
          size={40}
          mr="$3"
          source={{ uri: item.logo }}
          fallback={
            <Image.Fallback>
              <Icon size={40} name="GlobusOutline" color="$iconSubdued" />
            </Image.Fallback>
          }
        />
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {getConnectedSiteTitle(item.url)}
        </SizableText>
      </XStack>
      <YStack p="$3" backgroundColor="$bgSubdued">
        {item.networkIds.map((networkId, i) => (
          <XStack key={networkId} alignItems="center">
            <Stack mr="$2">
              <NetworkAvatar size={16} networkId={networkId} />
            </Stack>
            <SizableText color="$textSubdued" size="$bodySmMedium">
              {utils.shortenAddress({ address: item.addresses[i] })}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  </Stack>
);

type ISectionListData = {
  title: string;
  data: IConnectedSite[];
};

const ListEmptyComponent = ({ onRetry }: { onRetry?: () => void }) => {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: onRetry
          ? ETranslations.global_an_error_occurred
          : ETranslations.settings_no_connected_sites,
      })}
      description={intl.formatMessage({
        id: onRetry
          ? ETranslations.global_an_error_occurred_desc
          : ETranslations.settings_no_connected_sites_desc,
      })}
      illustration={onRetry ? undefined : 'DocumentGlobeCenter'}
      buttonProps={
        onRetry
          ? {
              children: intl.formatMessage({ id: ETranslations.global_retry }),
              onPress: onRetry,
              testID: 'signature-connected-sites-retry',
            }
          : undefined
      }
    />
  );
};

const keyExtractor = (item: unknown) => {
  const createdAt = (item as IConnectedSite)?.createdAt;
  const url = (item as IConnectedSite)?.url;
  return `${url}${createdAt}`;
};

export const ConnectedSites = () => {
  const { sections, isLoading, hasError, onRetry, onEndReached } =
    useGetSignatureSections(async (params) =>
      backgroundApiProxy.serviceSignature.getConnectedSites(params),
    );

  const listEmptyComponent = hasError ? (
    <ListEmptyComponent onRetry={onRetry} />
  ) : (
    ListEmptyComponent
  );

  return (
    <Tabs.SectionList
      windowSize={platformEnv.isNativeAndroid ? 3 : undefined}
      stickySectionHeadersEnabled={false}
      sections={sections}
      // estimatedItemSize={154}
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          px={SETTINGS_PAGE_CONTENT_PADDING_X}
          title={(section as ISectionListData).title}
        />
      )}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => <ConnectedSiteItem item={item} />}
      ListEmptyComponent={
        isLoading ? (
          <Skeleton.Group show>
            <YStack px={SETTINGS_PAGE_CONTENT_PADDING_X} pt="$3" gap="$3">
              <Skeleton w="100%" h="$24" />
              <Skeleton w="100%" h="$24" />
            </YStack>
          </Skeleton.Group>
        ) : (
          listEmptyComponent
        )
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
