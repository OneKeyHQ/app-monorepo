import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  Icon,
  Image,
  SectionList,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import utils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IConnectedSite } from '@onekeyhq/shared/types/signatureRecord';

import { useGetSignatureSections } from './hooks';

const getConnectedSiteTitle = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const ConnectedSiteItem = ({ item }: { item: IConnectedSite }) => (
  <YStack
    borderWidth={StyleSheet.hairlineWidth}
    mx="$5"
    mb="$3"
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
        width={40}
        height={40}
        mr="$3"
      >
        <Image.Source
          source={{
            uri: item.logo,
          }}
        />
        <Image.Fallback
          alignItems="center"
          justifyContent="center"
          bg="$gray5"
          delayMs={1000}
        >
          <Icon size={40} name="GlobusOutline" color="$iconSubdued" />
        </Image.Fallback>
      </Image>
      <SizableText size="$bodyLgMedium">
        {getConnectedSiteTitle(item.url)}
      </SizableText>
    </XStack>
    <YStack p="$3" backgroundColor="$bgSubdued">
      {item.networkIds.map((networkId, i) => (
        <XStack key={networkId} alignItems="center">
          <Stack mr="$2">
            <NetworkAvatar size={16} networkId={networkId} />
          </Stack>
          <SizableText color="$textSubdued">
            {item.networks[i].name}
            {' • '}
            {utils.shortenAddress({ address: item.addresses[i] })}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  </YStack>
);

type ISectionListData = {
  title: string;
  data: IConnectedSite[];
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: ETranslations.settings_no_connected_sites,
      })}
      description={intl.formatMessage({
        id: ETranslations.settings_no_connected_sites_desc,
      })}
      icon="ClockAlertOutline"
    />
  );
};

export const ConnectedSites = () => {
  const { sections, onEndReached } = useGetSignatureSections(async (params) =>
    backgroundApiProxy.serviceSignature.getConnectedSites(params),
  );

  return (
    <SectionList
      sections={sections}
      estimatedItemSize="$36"
      ItemSeparatorComponent={null}
      SectionSeparatorComponent={null}
      renderSectionHeader={({ section }) => (
        <SectionList.SectionHeader
          title={(section as ISectionListData).title}
        />
      )}
      renderItem={({ item }) => <ConnectedSiteItem item={item} />}
      ListEmptyComponent={ListEmptyComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
};
