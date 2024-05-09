import { useCallback, useState } from 'react';

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

export function UniversalSearch() {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [sections, setSections] = useState<IUniversalSection[]>([]);
  const handleTextChange = useCallback(
    async (val: string) => {
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
      // const firstAddressItemPayload =
      //   result?.[EUniversalSearchType.Address]?.items?.[0]?.payload;
      // console.log(input, result);
      // if (firstAddressItemPayload) {
      //   const { network, addressInfo } = firstAddressItemPayload;
      //   urlAccountNavigation.pushUrlAccountPage(navigation, {
      //     address: addressInfo.displayAddress,
      //     networkId: network.id,
      //   });
      // } else {
      //   Toast.error({
      //     title: 'No result found',
      //   });
      // }
    },
    [activeAccount?.network?.id],
  );

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
          <SearchBar onSearchTextChange={handleTextChange} />
        </View>
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
                <NetworkAvatar networkId={item.payload.network.id} size="$8" />
              }
              title={item.payload.network.shortname}
              subtitle={item.payload.addressInfo.displayAddress}
            />
          )}
          estimatedItemSize="$16"
        />
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
