import { useCallback, useContext, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IListViewRef } from '@onekeyhq/components';
import { Empty, SearchBar, SectionList, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePureChainSelectorSections } from '../../hooks/usePureChainSelectorSections';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';
import NetworkListHeader from './NetworkListHeader';
import NetworkListItem from './NetworkListItem';

import type {
  IPureChainSelectorSectionListItem,
  IServerNetworkMatch,
} from '../../types';

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
    />
  );
};

function NetworksSectionList() {
  const intl = useIntl();

  const { networks, searchKey, setSearchKey } = useContext(
    AllNetworksManagerContext,
  );

  const listRef = useRef<IListViewRef<any> | null>(null);

  const { sections } = usePureChainSelectorSections({
    networks: networks.mainNetworks,
    frequentlyUsedNetworks: networks.frequentlyUsedNetworks,
    searchKey,
  });

  const renderSectionHeader = useCallback(
    (item: { section: IPureChainSelectorSectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
      return <Stack />;
    },
    [],
  );

  return (
    <Stack flex={1}>
      <Stack px="$5">
        <SearchBar
          testID="all-networks-manager-search-bar"
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
          value={searchKey}
          onChangeText={(text) => {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            listRef?.current?._listRef?._scrollRef?.scrollTo?.({
              y: 0,
              animated: false,
            });
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (listRef?.current?._listRef?._hasDoneInitialScroll) {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              listRef.current._listRef._hasDoneInitialScroll = false;
            }
            setSearchKey(text.trim());
          }}
          {...(!platformEnv.isNative && {
            autoFocus: true,
          })}
        />
      </Stack>
      <Stack flex={1}>
        {sections.length > 0 ? (
          <SectionList
            ref={listRef as any}
            contentContainerStyle={
              platformEnv.isNative
                ? undefined
                : {
                    minHeight: '100vh',
                  }
            }
            estimatedItemSize={48}
            sections={sections}
            keyExtractor={(item) => (item as IServerNetworkMatch).id}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={<NetworkListHeader />}
            renderItem={({ item }: { item: IServerNetworkMatch }) => (
              <NetworkListItem network={item} />
            )}
          />
        ) : (
          <ListEmptyComponent />
        )}
      </Stack>
    </Stack>
  );
}

export default NetworksSectionList;
