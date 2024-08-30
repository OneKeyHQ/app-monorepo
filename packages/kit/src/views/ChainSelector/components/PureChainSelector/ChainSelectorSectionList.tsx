import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  SearchBar,
  SectionList,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFuseSearch } from '../../hooks/useFuseSearch';

import type { IServerNetworkMatch } from '../../types';

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

type ISectionListItem = {
  title?: string;
  data: IServerNetworkMatch[];
  isUnavailable?: boolean;
};

type IChainSelectorSectionListContentProps = {
  sections: ISectionListItem[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
};

const ChainSelectorSectionListContent = ({
  sections,
  onPressItem,
  networkId,
}: IChainSelectorSectionListContentProps) => {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  const renderSectionHeader = useCallback(
    (item: { section: ISectionListItem }) => {
      if (item.section.title) {
        return <SectionList.SectionHeader title={item.section.title} />;
      }
      return <Stack />;
    },
    [],
  );

  return (
    <SectionList
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={<Stack h={bottom || '$2'} />}
      estimatedItemSize={48}
      sections={sections}
      keyExtractor={(item) => (item as IServerNetworkMatch).id}
      renderSectionHeader={renderSectionHeader}
      renderItem={({
        item,
        section,
      }: {
        item: IServerNetworkMatch;
        section: ISectionListItem;
      }) => (
        <ListItem
          h={48}
          renderAvatar={<NetworkAvatarBase logoURI={item.logoURI} size="$8" />}
          title={
            item.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : item.name
          }
          opacity={section.isUnavailable ? 0.7 : 1}
          titleMatch={item.titleMatch}
          onPress={
            !section.isUnavailable ? () => onPressItem?.(item) : undefined
          }
          testID={`select-item-${item.id}`}
        >
          {networkId === item.id ? (
            <ListItem.CheckMark key="checkmark" />
          ) : null}
        </ListItem>
      )}
    />
  );
};

type IChainSelectorSectionListProps = {
  networks: IServerNetworkMatch[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
  unavailable?: IServerNetworkMatch[];
};

export const ChainSelectorSectionList: FC<IChainSelectorSectionListProps> = ({
  networks,
  networkId,
  unavailable,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const intl = useIntl();
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const networkFuseSearch = useFuseSearch(networks);

  const sections = useMemo<ISectionListItem[]>(() => {
    if (text) {
      const data = networkFuseSearch(text);
      return data.length === 0
        ? []
        : [
            {
              data,
            },
          ];
    }
    const testnetItems: IServerNetworkMatch[] = [];
    const mainnetItems: IServerNetworkMatch[] = [];
    for (let i = 0; i < networks.length; i += 1) {
      const item = networks[i];
      if (item.isTestnet) {
        testnetItems.push(item);
      } else {
        mainnetItems.push(item);
      }
    }

    const data = mainnetItems.reduce((acc, item) => {
      const char = item.name[0].toUpperCase();
      if (!acc[char]) {
        acc[char] = [];
      }
      acc[char].push(item);
      return acc;
    }, {} as Record<string, IServerNetworkMatch[]>);

    const mainnetSections = Object.entries(data)
      .map(([key, value]) => ({ title: key, data: value }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));

    const _sections: ISectionListItem[] = [...mainnetSections];

    if (testnetItems.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.global_testnet,
        }),
        data: testnetItems,
      });
    }

    if (unavailable && unavailable.length > 0) {
      _sections.push({
        title: intl.formatMessage({
          id: ETranslations.network_selector_unavailable_networks,
        }),
        data: unavailable,
        isUnavailable: true,
      });
    }

    return _sections;
  }, [networkFuseSearch, text, networks, intl, unavailable]);
  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <ChainSelectorSectionListContent
        sections={sections}
        networkId={networkId}
        onPressItem={onPressItem}
      />
    </Stack>
  );
};
