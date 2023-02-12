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
import type { Token } from '@onekeyhq/engine/src/types/token';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountTokensBalance } from '../../../hooks';
import { FiatPayRoutes } from '../../../routes/Modal/FiatPay';
import { useFiatPayTokens } from '../../ManageTokens/hooks';

import type { FiatPayModalRoutesParams } from '../../../routes/Modal/FiatPay';
import type { TokenBalanceValue } from '../../../store/reducers/tokens';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';

type TokenWithBalance = Token & { balance: string };

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
  tokens: TokenWithBalance[],
  terms: string,
): TokenWithBalance[] {
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

function fetchBalance(
  currencies: Token[],
  balances: Record<string, TokenBalanceValue>,
): TokenWithBalance[] {
  return currencies.map((item) => {
    let balance: TokenBalanceValue = {
      balance: '0',
    };
    const address = item.address as string;
    if (address === '') {
      balance = balances.main;
    } else {
      balance = balances[address];
    }
    return { ...item, balance: balance?.balance ?? '0' };
  });
}
export const SupportTokenList: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, type = 'buy' } = route.params;
  const { tokenList: tokenListNobalance } = useFiatPayTokens(networkId, type);
  const { accountId, account } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(networkId, accountId);
  const currencies = fetchBalance(tokenListNobalance, balances);
  const [searchResult, updateSearchResult] = useState<TokenWithBalance[]>([]);
  const [searchText, updateSearchText] = useState<string>('');
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { serviceFiatPay } = backgroundApiProxy;

  const flatListData = useMemo(
    () => (searchText.length > 0 ? searchResult : currencies),
    [currencies, searchResult, searchText.length],
  );

  const buyAction = useCallback(
    async (token: TokenWithBalance) => {
      const signedUrl = await serviceFiatPay.getFiatPayUrl({
        type,
        cryptoCode: token.onramperId,
        address: account?.address,
      });
      if (signedUrl.length > 0) {
        navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
          url: signedUrl,
        });
      }
    },
    [account?.address, navigation, serviceFiatPay, type],
  );
  const sellAction = useCallback(
    async (token: TokenWithBalance) => {
      const signedUrl = await serviceFiatPay.getFiatPayUrl({
        type,
        cryptoCode: token.moonpayId,
        address: account?.address,
      });
      if (signedUrl.length > 0) {
        navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
          url: signedUrl,
        });
      }
    },
    [account?.address, navigation, serviceFiatPay, type],
  );

  const renderItem: ListRenderItem<TokenWithBalance> = useCallback(
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
          if (type === 'buy') {
            buyAction(item);
          } else {
            sellAction(item);
          }
        }}
      >
        <Box flex={1} flexDirection="row" alignItems="center">
          <TokenImage
            size={8}
            token={{ logoURI: item.logoURI }}
            name={item.name}
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
    [buyAction, sellAction, type],
  );

  const ListEmptyComponent = useCallback(
    () => (
      <Box>
        <Empty
          title={intl.formatMessage({
            id:
              type === 'buy'
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
    [intl, type],
  );

  const separator = useCallback(() => <Box h="8px" />, []);

  return (
    <Modal
      maxHeight="560px"
      height="560px"
      header={intl.formatMessage({
        id: type === 'buy' ? 'action__buy' : 'action__sell',
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
        keyExtractor: (item) => (item as TokenWithBalance).address ?? '',
        ItemSeparatorComponent: separator,
        ListEmptyComponent,
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
