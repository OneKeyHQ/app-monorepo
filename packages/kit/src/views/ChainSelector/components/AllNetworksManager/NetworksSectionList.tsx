import { useCallback, useContext, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IListViewRef } from '@onekeyhq/components';
import {
  Checkbox,
  Empty,
  SearchBar,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import { usePureChainSelectorSections } from '../../hooks/usePureChainSelectorSections';
import ChainSelectorTooltip from '../ChainSelectorTooltip';
import DottedLine from '../DottedLine';

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
      illustration="BlockQuestionMark"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
    />
  );
};

function NetworksSectionList() {
  const intl = useIntl();

  const {
    networks,
    searchKey,
    setSearchKey,
    accountNetworkValues,
    accountNetworkValueCurrency,
    accountDeFiOverview,
    networksState,
    setNetworksState,
  } = useContext(AllNetworksManagerContext);

  const listRef = useRef<IListViewRef<any> | null>(null);

  const { sections } = usePureChainSelectorSections({
    networks: networks.mainNetworks,
    searchKey,
    accountNetworkValues,
    accountDeFiOverview,
  });

  // Check if all networks in a section are enabled
  const getSectionCheckState = useCallback(
    (sectionData: IServerNetworkMatch[]) => {
      const enabledCount = sectionData.filter((network) =>
        isEnabledNetworksInAllNetworks({
          networkId: network.id,
          enabledNetworks: networksState.enabledNetworks,
          disabledNetworks: networksState.disabledNetworks,
          isTestnet: network.isTestnet,
        }),
      ).length;

      if (enabledCount === 0) return false;
      if (enabledCount === sectionData.length) return true;
      return 'indeterminate';
    },
    [networksState.enabledNetworks, networksState.disabledNetworks],
  );

  // Toggle all networks in a section
  const toggleSectionNetworks = useCallback(
    (sectionData: IServerNetworkMatch[], enable: boolean) => {
      const updates = sectionData.reduce(
        (acc, network) => {
          acc.enabledNetworks[network.id] = enable;
          acc.disabledNetworks[network.id] = !enable;
          return acc;
        },
        {
          enabledNetworks: {} as Record<string, boolean>,
          disabledNetworks: {} as Record<string, boolean>,
        },
      );

      setNetworksState((prev) => ({
        enabledNetworks: {
          ...prev.enabledNetworks,
          ...updates.enabledNetworks,
        },
        disabledNetworks: {
          ...prev.disabledNetworks,
          ...updates.disabledNetworks,
        },
      }));
    },
    [setNetworksState],
  );

  const renderSectionHeader = useCallback(
    (item: { section: IPureChainSelectorSectionListItem }) => {
      if (item.section.title) {
        // Show total value and checkbox for "Found assets on these networks" section
        if (item.section.totalValue) {
          const checkState = getSectionCheckState(item.section.data);
          return (
            <XStack
              px="$5"
              py="$2"
              bg="$bg"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack flex={1} mr="$2" alignItems="flex-start">
                <ChainSelectorTooltip
                  renderContent={intl.formatMessage({
                    id: ETranslations.network_auto_detection_tip,
                  })}
                  renderTrigger={
                    <Stack>
                      <SizableText size="$headingSm" color="$textSubdued">
                        {item.section.title}
                      </SizableText>
                      <DottedLine mt={1} />
                    </Stack>
                  }
                />
              </Stack>
              <XStack flexShrink={0} gap="$3" alignItems="center">
                <Currency
                  hideValue
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  sourceCurrency={accountNetworkValueCurrency}
                >
                  {item.section.totalValue}
                </Currency>
                <Checkbox
                  value={checkState}
                  onChange={() => {
                    const shouldEnable = checkState !== true;
                    toggleSectionNetworks(item.section.data, shouldEnable);
                  }}
                />
              </XStack>
            </XStack>
          );
        }
        return <SectionList.SectionHeader title={item.section.title} />;
      }
      return <Stack />;
    },
    [
      accountNetworkValueCurrency,
      getSectionCheckState,
      intl,
      toggleSectionNetworks,
    ],
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
            setSearchKey(text);
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
