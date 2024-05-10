import { useCallback, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import {
  Empty,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { urlAccountNavigation } from '../../Home/pages/urlAccount/urlAccountUtils';

interface IUniversalSection {
  title: string;
  data: IUniversalSearchResultItem[];
}

enum ESearchStatus {
  init = 'init',
  loading = 'loading',
  done = 'done',
}

const SkeletonItem = () => (
  <XStack p="$2.5" alignItems="center" space="$4">
    <Skeleton w="$10" h="$10" radius="round" />
    <YStack space="$3">
      <Skeleton h="$3" w="$32" />
      <Skeleton h="$3" w="$24" />
    </YStack>
  </XStack>
);

export function UniversalSearch() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [sections, setSections] = useState<IUniversalSection[]>([]);
  const [searchStatus, setSearchStatus] = useState<ESearchStatus>(
    ESearchStatus.init,
  );
  const handleTextChange = useDebouncedCallback(async (val: string) => {
    const input = val?.trim?.() || '';
    const result = await backgroundApiProxy.serviceApp.universalSearch({
      input,
      networkId: activeAccount?.network?.id,
      searchTypes: [EUniversalSearchType.Address],
    });
    const items = result?.[EUniversalSearchType.Address]?.items;
    if (items?.length) {
      setSections([
        {
          title: 'Wallet',
          data: items,
        },
      ]);
    } else {
      setSections([]);
    }
    setSearchStatus(ESearchStatus.done);
  }, 1200);

  const handleChangeText = useCallback(() => {
    setSearchStatus(ESearchStatus.loading);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: IUniversalSection }) => (
      <SizableText px="$5" pb={0} size="$headingSm">
        {section.title}
      </SizableText>
    ),
    [],
  );

  const renderResult = useCallback(() => {
    switch (searchStatus) {
      case ESearchStatus.init:
        return null;

      case ESearchStatus.loading:
        return (
          <View px="$5">
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </View>
        );

      case ESearchStatus.done:
        return (
          <SectionList
            sections={sections}
            renderSectionHeader={renderSectionHeader}
            ListEmptyComponent={
              <Empty icon="SearchOutline" title="No Results" />
            }
            renderItem={({ item }: { item: IUniversalSearchResultItem }) => (
              <ListItem
                onPress={() => {
                  navigation.pop();
                  setTimeout(() => {
                    const { network, addressInfo } = item.payload;
                    urlAccountNavigation.pushUrlAccountPage(navigation, {
                      address: addressInfo.displayAddress,
                      networkId: network.id,
                    });
                  }, 80);
                }}
                renderAvatar={
                  <NetworkAvatar
                    networkId={item.payload.network.id}
                    size="$8"
                  />
                }
                title={item.payload.network.shortname}
                subtitle={item.payload.addressInfo.displayAddress}
              />
            )}
            estimatedItemSize="$16"
          />
        );
      default:
        break;
    }
  }, [navigation, renderSectionHeader, searchStatus, sections]);

  return (
    <Page>
      <Page.Header title="Search" />
      <Page.Body>
        <View p="$5" pt={0}>
          <SearchBar
            autoFocus
            placeholder="Search"
            onSearchTextChange={handleTextChange}
            onChangeText={handleChangeText}
          />
        </View>
        {renderResult()}
      </Page.Body>
    </Page>
  );
}

const UniversalSearchProvider = () => (
  <AccountSelectorProviderMirror
    config={{
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
    }}
    enabledNum={[0]}
  >
    <UniversalSearch />
  </AccountSelectorProviderMirror>
);

export default UniversalSearchProvider;
