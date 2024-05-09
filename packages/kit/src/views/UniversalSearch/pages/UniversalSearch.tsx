import { useCallback, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import {
  Page,
  SearchBar,
  SectionList,
  SizableText,
  View,
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
    setSections([
      {
        title: 'Wallet',
        data: result?.[EUniversalSearchType.Address]?.items || [],
      },
    ]);
    setSearchStatus(ESearchStatus.done);
  });

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
  return (
    <Page>
      <Page.Header title="Search" />
      <Page.Body>
        <View p="$5">
          <SearchBar
            onSearchTextChange={handleTextChange}
            onChangeText={handleChangeText}
          />
        </View>
        {
          // TODO:
          // not found component
        }
        {searchStatus === ESearchStatus.done && sections.length ? (
          <SectionList
            sections={sections}
            renderSectionHeader={renderSectionHeader}
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
        ) : null}
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
