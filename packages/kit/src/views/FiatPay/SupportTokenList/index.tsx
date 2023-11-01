import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import Fuse from 'fuse.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  Icon,
  KeyboardDismissView,
  List,
  ListItem,
  Modal,
  Pressable,
  Searchbar,
  Skeleton,
  Text,
  Token as TokenImage,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../components/Format';
import {
  useActiveSideAccount,
  useNavigation,
  useTokenBalance,
} from '../../../hooks';
import { openUrlExternal } from '../../../utils/openUrl';
import { useFiatPayTokens } from '../../ManageTokens/hooks';

import type { FiatPayModalRoutesParams } from '../../../routes/Root/Modal/FiatPay';
import type { FiatPayModalRoutes } from '../../../routes/routesEnum';
import type { FiatPayModeType } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayModalRoutes.SupportTokenListModal
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
  const navigation = useNavigation();
  const balance = useTokenBalance({
    accountId,
    networkId,
    token,
    fallback: '0',
    useRecycleBalance: token.isNative ?? true,
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

  const { serviceFiatPay } = backgroundApiProxy;

  const goToWebView = useCallback(async () => {
    const signedUrl = await serviceFiatPay.getFiatPayUrl({
      type,
      tokenAddress: token.address,
      address,
      networkId,
    });
    if (signedUrl.length > 0) {
      openUrlExternal(signedUrl);
      navigation?.goBack();
    }
  }, [address, networkId, serviceFiatPay, token.address, type, navigation]);

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
        goToWebView();
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

const SupportTokenList: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId, type = 'buy' } = route.params;
  const { tokenList, loading } = useFiatPayTokens(networkId, type);
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

  const emptyComponent = useCallback(
    () => (
      <KeyboardDismissView>
        <Empty
          flex={1}
          title={intl.formatMessage({
            id:
              type === 'buy'
                ? 'empty__no_purchasable_tokens'
                : 'empty__no_salable_tokens',
          })}
          subTitle={intl.formatMessage({
            id: 'empty__no_purchasable_tokens_desc',
          })}
          emoji="🥺"
        />
      </KeyboardDismissView>
    ),
    [intl, type],
  );

  return (
    <Modal
      header={intl.formatMessage({
        id: type === 'buy' ? 'action__buy' : 'action__sell',
      })}
      height="560px"
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
    >
      <Searchbar
        w="full"
        value={searchText}
        mb="4"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        onChangeText={(text) => {
          updateSearchText(text);
          updateSearchResult(() => searchTokens(tokenList, text));
        }}
        onClear={() => updateSearchText('')}
      />
      {loading ? (
        // TODO:Skeleton list
        <List
          data={[1, 2, 3, 4, 5]}
          renderItem={() => (
            <ListItem>
              <ListItem.Column>
                <Skeleton shape="Avatar" />
              </ListItem.Column>
              <ListItem.Column
                flex={1}
                text={{
                  label: <Skeleton shape="Body1" />,
                }}
              />
              <ListItem.Column>
                <Skeleton shape="Body1" />
              </ListItem.Column>
              <ListItem.Column
                icon={{
                  name: 'ChevronRightMini',
                  size: 20,
                  color: 'icon-disabled',
                }}
              />
            </ListItem>
          )}
        />
      ) : (
        <List
          data={flatListData}
          contentContainerStyle={{
            flex: flatListData?.length ? undefined : 1,
          }}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={emptyComponent}
        />
      )}
    </Modal>
  );
};

export default SupportTokenList;
