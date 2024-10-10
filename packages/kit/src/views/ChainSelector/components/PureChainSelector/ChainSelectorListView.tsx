import { type FC, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
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

type IChainSelectorListViewProps = {
  networks: IServerNetworkMatch[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
};

const ChainSelectorListViewContent = ({
  networks,
  onPressItem,
  networkId,
}: IChainSelectorListViewProps) => {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  return (
    <ListView
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={<Stack h={bottom || '$2'} />}
      estimatedItemSize={48}
      data={networks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ListItem
          h={48}
          renderAvatar={
            <NetworkAvatarBase
              logoURI={item.logoURI}
              isCustomNetwork={item.isCustomNetwork}
              networkName={item.name}
              size="$8"
            />
          }
          title={
            item.isAllNetworks
              ? intl.formatMessage({ id: ETranslations.global_all_networks })
              : item.name
          }
          titleMatch={item.titleMatch}
          onPress={() => onPressItem?.(item)}
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

export const ChainSelectorListView: FC<IChainSelectorListViewProps> = ({
  networks,
  networkId,
  onPressItem,
}) => {
  const [text, setText] = useState('');
  const intl = useIntl();
  const onChangeText = useCallback((value: string) => {
    setText(value.trim());
  }, []);

  const networkFuseSearch = useFuseSearch(networks);

  const data = useMemo(() => {
    if (!text) {
      return networks;
    }
    return networkFuseSearch(text);
  }, [networkFuseSearch, text, networks]);
  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$4">
        <SearchBar
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={text}
          onChangeText={onChangeText}
        />
      </Stack>
      <ChainSelectorListViewContent
        networkId={networkId}
        networks={data}
        onPressItem={onPressItem}
      />
    </Stack>
  );
};
