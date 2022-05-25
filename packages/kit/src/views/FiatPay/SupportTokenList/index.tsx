import React, { FC, useCallback, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Fuse from 'fuse.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  Modal,
  NetImage,
  Pressable,
  Searchbar,
  Text,
} from '@onekeyhq/components';
import { CDN_PREFIX } from '@onekeyhq/components/src/utils';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { useManageTokens } from '../../../hooks';
import { useFiatPay } from '../../../hooks/redux';
import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';
import { TokenBalanceValue } from '../../../store/reducers/tokens';
import { CurrencyType } from '../types';

type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayRoutes.SupportTokenListModal
>;

const options = {
  keys: [
    {
      name: 'tokenName',
      weight: 1,
    },
  ],
};

export function searchTokens(
  tokens: CurrencyType[],
  terms: string,
): CurrencyType[] {
  const fuse = new Fuse(tokens, options);
  const searchResult = fuse.search(terms);
  return searchResult.map((item) => item.item);
}

type NavigationProps = ModalScreenProps<FiatPayModalRoutesParams>;
type HeaderProps = {
  onChange: (keyword: string) => void;
};

const Header: FC<HeaderProps> = ({ onChange }) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={value}
        onClear={() => onChange('')}
        onChangeText={(text) => {
          setValue(text);
          onChange(text);
        }}
      />
    </Box>
  );
};

const buildUrl = (_chain = '', _address = '') => {
  const chain = _chain.toLowerCase();
  const address = _address.toLowerCase();
  if (chain && !address) return `${CDN_PREFIX}assets/${chain}/${chain}.png`;
  return `${CDN_PREFIX}assets/${chain}/${address}.png`;
};

function fetchBalance(
  currencies: CurrencyType[],
  balances: Record<string, TokenBalanceValue>,
): CurrencyType[] {
  return currencies.map((item) => {
    let balance: TokenBalanceValue = '0';
    const logoURI = buildUrl(item.networkName, item.contract);
    if (item.contract === '') {
      balance = balances.main;
    } else {
      balance = balances[item.contract];
    }
    return { ...item, balance, logoURI };
  });
}
export const SupportTokenList: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId } = route.params;
  const currenciesNobalance = useFiatPay(networkId);
  const { balances } = useManageTokens();
  const currencies = fetchBalance(currenciesNobalance, balances);
  const [searchResult, updateSearchResult] = useState<CurrencyType[]>([]);
  const navigation = useNavigation<NavigationProps['navigation']>();

  const flatListData = useMemo(
    () => (searchResult.length > 0 ? searchResult : currencies),
    [currencies, searchResult],
  );
  const renderItem: ListRenderItem<CurrencyType> = useCallback(
    ({ item, index }) => (
      <Pressable
        height="64px"
        bgColor="surface-default"
        borderTopRadius={index === 0 ? '12px' : 0}
        borderBottomRadius={index === flatListData.length - 1 ? '12px' : 0}
        flex={1}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        padding="16px"
        onPress={() => {
          navigation.navigate(FiatPayRoutes.AmoutInputModal, {
            token: item,
            type: 'Buy',
          });
        }}
      >
        <Box flexDirection="row" alignItems="center">
          <NetImage
            uri={item.logoURI}
            size={32}
            borderRadius={16}
            bgColor="icon-default"
          />
          <Text typography="Body1Strong" ml="12px">
            {item.symbol}
          </Text>
        </Box>
        <Text typography="Body1Strong" color="text-subdued">
          {item.balance ?? 0}
        </Text>
      </Pressable>
    ),
    [flatListData.length, navigation],
  );

  return (
    <Modal
      height="560px"
      header={intl.formatMessage({ id: 'action__buy' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
      flatListProps={{
        data: flatListData,
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        showsVerticalScrollIndicator: false,
        keyExtractor: (item) => (item as CurrencyType).tokenName,

        ListHeaderComponent: (
          <Header
            onChange={(text) => {
              updateSearchResult(() => searchTokens(currencies, text));
            }}
          />
        ),
      }}
    />
  );
};

export default SupportTokenList;
