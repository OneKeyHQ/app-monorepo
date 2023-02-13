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
  Skeleton,
  Text,
  Token as TokenImage,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../components/Format';
import { useActiveSideAccount } from '../../../hooks';
import { useTokenBalance } from '../../../hooks/useTokens';
import { FiatPayRoutes } from '../../../routes/Modal/FiatPay';
import { useFiatPayTokens } from '../../ManageTokens/hooks';

import type { FiatPayModalRoutesParams } from '../../../routes/Modal/FiatPay';
import type { FiatPayModeType } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';

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

export function searchTokens(tokens: Token[], terms: string): Token[] {
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

type ListCellProps = {
  token: Token;
  address?: string;
  type: FiatPayModeType;
  accountId: string;
  networkId: string;
  network?: Network | null;
};
const TokenListCell: FC<ListCellProps> = ({
  token,
  type,
  address,
  accountId,
  networkId,
  network,
}) => {
  const balance = useTokenBalance({
    accountId,
    networkId,
    token,
    fallback: '0',
  });

  const tokenId = token?.tokenIdOnNetwork || 'main';

  const decimal =
    tokenId === 'main'
      ? network?.nativeDisplayDecimals
      : network?.tokenDisplayDecimals;

  const formatedBalance = useMemo(() => {
    if (typeof balance === 'undefined') {
      return <Skeleton shape="Body2" />;
    }
    return (
      <FormatBalance
        balance={balance}
        formatOptions={{
          fixed: decimal ?? 4,
        }}
        render={(ele) => (
          <Text typography="Body1" color="text-subdued" mr="4px">
            {ele}
          </Text>
        )}
      />
    );
  }, [balance, decimal]);

  const navigation = useNavigation<NavigationProps['navigation']>();
  const { serviceFiatPay } = backgroundApiProxy;

  const buyAction = useCallback(async () => {
    const signedUrl = await serviceFiatPay.getFiatPayUrl({
      type,
      cryptoCode: token.onramperId,
      address,
    });
    if (signedUrl.length > 0) {
      navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
        url: signedUrl,
      });
    }
  }, [address, navigation, serviceFiatPay, token.onramperId, type]);
  const sellAction = useCallback(async () => {
    const signedUrl = await serviceFiatPay.getFiatPayUrl({
      type,
      cryptoCode: token.moonpayId,
      address,
    });
    if (signedUrl.length > 0) {
      navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
        url: signedUrl,
      });
    }
  }, [address, navigation, serviceFiatPay, token.moonpayId, type]);
  return (
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
          buyAction();
        } else {
          sellAction();
        }
      }}
    >
      <Box flex={1} flexDirection="row" alignItems="center">
        <TokenImage
          size={8}
          token={{ logoURI: token.logoURI }}
          name={token.name}
        />
        <Text typography="Body1Strong" ml="12px">
          {token.symbol}
        </Text>
      </Box>
      {formatedBalance}
      <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
    </Pressable>
  );
};

export const SupportTokenList: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId, type = 'buy' } = route.params;
  const { tokenList } = useFiatPayTokens(networkId, type);
  const { account, network } = useActiveSideAccount({ networkId, accountId });

  const [searchResult, updateSearchResult] = useState<Token[]>([]);
  const [searchText, updateSearchText] = useState<string>('');

  const flatListData = useMemo(
    () => (searchText.length > 0 ? searchResult : tokenList),
    [tokenList, searchResult, searchText.length],
  );

  const renderItem: ListRenderItem<Token> = useCallback(
    ({ item }) => (
      <TokenListCell
        token={item}
        address={account?.address}
        type={type}
        accountId={accountId}
        networkId={networkId}
        network={network}
      />
    ),
    [account?.address, accountId, network, networkId, type],
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
        keyExtractor: (item) => (item as Token).address ?? '',
        ItemSeparatorComponent: separator,
        ListEmptyComponent,
        ListHeaderComponent: (
          <Header
            onChange={(text) => {
              updateSearchText(text);
              updateSearchResult(() => searchTokens(tokenList, text));
            }}
          />
        ),
        mx: '-8px',
      }}
    />
  );
};

export default SupportTokenList;
