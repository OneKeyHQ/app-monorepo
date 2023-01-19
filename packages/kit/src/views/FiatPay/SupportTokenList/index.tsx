import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import Fuse from 'fuse.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  Icon,
  Modal,
  Pressable,
  Searchbar,
  Text,
  Token as TokenImage,
} from '@onekeyhq/components';
import { CDN_PREFIX } from '@onekeyhq/components/src/utils';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount, useFiatPay } from '../../../hooks/redux';
import { FiatPayRoutes } from '../../../routes/Modal/FiatPay';

import type { FiatPayModalRoutesParams } from '../../../routes/Modal/FiatPay';
import type { TokenBalanceValue } from '../../../store/reducers/tokens';
import type { CurrencyType } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';
import { useAccountTokensBalance } from '../../../hooks';

type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayRoutes.SupportTokenListModal
>;

const options = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    {
      name: 'symbol',
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
    <Box px="8px" mb="16px">
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        value={value}
        onClear={() => {
          onChange('');
          setValue('');
        }}
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
  const { networkId, type = 'Buy' } = route.params;
  const currenciesNobalance = useFiatPay(networkId);
  const {accountId} = useActiveWalletAccount();
  const balances = useAccountTokensBalance(networkId, accountId);
  const currencies = fetchBalance(currenciesNobalance, balances);
  const [searchResult, updateSearchResult] = useState<CurrencyType[]>([]);
  const [searchText, updateSearchText] = useState<string>('');
  const navigation = useNavigation<NavigationProps['navigation']>();

  const flatListData = useMemo(
    () => (searchText.length > 0 ? searchResult : currencies),
    [currencies, searchResult, searchText.length],
  );
  const renderItem: ListRenderItem<CurrencyType> = useCallback(
    ({ item }) => (
      <Pressable
        flex={1}
        flexDirection="row"
        alignItems="center"
        p="8px"
        borderRadius="12px"
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
        onPress={() => {
          navigation.navigate(FiatPayRoutes.AmountInputModal, {
            token: item,
            type,
          });
        }}
      >
        <Box flex={1} flexDirection="row" alignItems="center">
          <TokenImage
            size={8}
            token={{ logoURI: item.logoURI }}
            name={item.tokenName}
          />
          <Text typography="Body1Strong" ml="12px">
            {item.symbol}
          </Text>
        </Box>
        <Text typography="Body1" color="text-subdued" mr="4px">
          {item.balance ?? 0}
        </Text>
        <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
      </Pressable>
    ),
    [navigation, type],
  );

  return (
    <Modal
      maxHeight="560px"
      header={intl.formatMessage({
        id: type === 'Buy' ? 'action__buy' : 'action__sell',
      })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
      flatListProps={{
        data: flatListData,
        // @ts-ignore
        renderItem,
        showsVerticalScrollIndicator: false,
        keyExtractor: (item) => (item as CurrencyType).tokenName,
        ItemSeparatorComponent: () => <Box h="8px" />,
        ListEmptyComponent: () => (
          <Box>
            <Empty
              title={intl.formatMessage({
                id:
                  type === 'Buy'
                    ? 'empty__no_purchasable_tokens'
                    : 'empty__no_salable_tokens',
              })}
              subTitle={intl.formatMessage({
                id: 'empty__no_purchasable_tokens_desc',
              })}
              icon="DatabaseMini"
            />
          </Box>
        ),
        ListHeaderComponent: (
          <Header
            onChange={(text) => {
              updateSearchText(text);
              updateSearchResult(() => searchTokens(currencies, text));
            }}
          />
        ),
        mx: '-8px',
      }}
    />
  );
};

export default SupportTokenList;
