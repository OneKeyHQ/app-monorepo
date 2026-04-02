import { type FC, useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { NETWORK_SHOW_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/networkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useFuseSearch } from '../../hooks/useFuseSearch';

import type { IServerNetworkMatch } from '../../types';

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

type IChainSelectorListViewProps = {
  networks: IServerNetworkMatch[];
  networkId?: string;
  onPressItem?: (network: IServerNetworkMatch) => void;
  accountNetworkValues?: Record<string, string>;
  accountNetworkValueCurrency?: string;
  hideLowValueNetworkValue?: boolean;
};

const ChainSelectorListViewContent = ({
  networks,
  onPressItem,
  networkId,
  accountNetworkValues,
  accountNetworkValueCurrency,
  hideLowValueNetworkValue,
}: IChainSelectorListViewProps) => {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  return (
    <ListView
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={<Stack h={bottom || '$2'} />}
      estimatedItemSize={48}
      initialNumToRender={platformEnv.isNative ? undefined : 40}
      data={networks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const networkValue = accountNetworkValues?.[item.id] ?? '0';
        const shouldShowValue =
          accountNetworkValues !== undefined &&
          (!hideLowValueNetworkValue ||
            new BigNumber(networkValue || 0).gt(
              NETWORK_SHOW_VALUE_THRESHOLD_USD,
            ));
        return (
          <ListItem
            h={48}
            renderAvatar={
              <NetworkAvatarBase
                logoURI={item.logoURI}
                isCustomNetwork={item.isCustomNetwork}
                networkName={item.name}
                isAllNetworks={item.isAllNetworks}
                allNetworksIconProps={{
                  color: '$iconActive',
                }}
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
            {/* eslint-disable no-nested-ternary */}
            {accountNetworkValues !== undefined ? (
              networkId === item.id ? (
                <ListItem.CheckMark key="checkmark" />
              ) : (
                <Stack w="$5" />
              )
            ) : networkId === item.id ? (
              <ListItem.CheckMark key="checkmark" />
            ) : null}
            {/* eslint-enable no-nested-ternary */}
            {shouldShowValue ? (
              <Currency
                hideValue
                numberOfLines={1}
                flexShrink={1}
                size="$bodyLgMedium"
                sourceCurrency={accountNetworkValueCurrency}
              >
                {networkValue}
              </Currency>
            ) : null}
          </ListItem>
        );
      }}
    />
  );
};

export const ChainSelectorListView: FC<IChainSelectorListViewProps> = ({
  networks,
  networkId,
  onPressItem,
  accountNetworkValues,
  accountNetworkValueCurrency,
  hideLowValueNetworkValue,
}) => {
  const [text, setText] = useState('');
  const intl = useIntl();
  const onChangeText = useCallback((value: string) => {
    setText(value);
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
      <Stack px="$5" pb="$2">
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
        accountNetworkValues={accountNetworkValues}
        accountNetworkValueCurrency={accountNetworkValueCurrency}
        hideLowValueNetworkValue={hideLowValueNetworkValue}
      />
    </Stack>
  );
};
