import type { FC } from 'react';
import { useCallback, useContext, useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  ListItem,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import {
  useAccountPortfolios,
  useActiveSideAccount,
  useTokenPositionInfo,
} from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useTokens';
import { TokenDetailContext } from '../context';

import DefiCell from './Cells/DefiCell';
import KeleStakingCell from './Cells/KeleStakingCell';
import LidoStakingCell from './Cells/LidoStakingCell';
import TokenCell from './Cells/TokenCell';

import type { ListRenderItem } from 'react-native';

const DefiListWithToken: FC = () => {
  const context = useContext(TokenDetailContext);
  const { networkId, accountId, tokenAddress } = context?.routeParams ?? {};
  const { defaultToken } = context?.detailInfo ?? {};
  const { data: defis } = useAccountPortfolios({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
    type: 'defis',
  });

  const genateList = useCallback(
    () =>
      defis.map((protocol) =>
        protocol.pools.map(([, items]) =>
          items
            .filter(
              ({ supplyTokens, rewardTokens }) =>
                supplyTokens.filter(
                  ({ tokenAddress: address }) => tokenAddress === address,
                ).length > 0 ||
                rewardTokens.filter(
                  ({ tokenAddress: address }) => tokenAddress === address,
                ).length > 0,
            )
            .map((item, index) => (
              <DefiCell
                protocolId={protocol._id.protocolId}
                token={defaultToken}
                key={`${protocol.protocolName}${item.poolType}${index}`}
                item={item}
                tokenId={defaultToken?.address ?? ''}
              />
            )),
        ),
      ),
    [defis, defaultToken, tokenAddress],
  );

  return <VStack>{genateList()}</VStack>;
};

const AssetsInfo: FC = () => {
  const intl = useIntl();
  const context = useContext(TokenDetailContext);

  const {
    walletId,
    accountId,
    networkId,
    tokenAddress,
    coingeckoId,
    sendAddress,
  } = context?.routeParams ?? {};
  const { defaultToken, symbol } = context?.detailInfo ?? {};
  const isVerticalLayout = useIsVerticalLayout();

  const price =
    useSimpleTokenPriceValue({
      networkId,
      contractAdress: defaultToken?.address,
    }) ?? 0;

  const { network } = useActiveSideAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });

  const totalAmount = useTokenPositionInfo({
    walletId: walletId ?? '',
    networkId: networkId ?? '',
    accountId: accountId ?? '',
    tokenAddress: tokenAddress ?? '',
    coingeckoId,
    sendAddress,
  });

  const listData = useMemo(
    () => [{ type: 'token' }, { type: 'keleStaking' }, { type: 'lidoStaking' }],
    [],
  );

  const renderItem: ListRenderItem<{ type: string }> = useCallback(
    ({ item }) => {
      if (item.type === 'token') {
        return (
          <TokenCell
            sendAddress={sendAddress}
            tokenId={defaultToken?.address ?? ''}
            token={defaultToken}
          />
        );
      }
      if (item.type === 'keleStaking') {
        return (
          <KeleStakingCell
            tokenId={defaultToken?.address ?? ''}
            networkId={networkId ?? ''}
            token={defaultToken}
          />
        );
      }
      if (item.type === 'lidoStaking') {
        return (
          <LidoStakingCell token={defaultToken} sendAddress={sendAddress} />
        );
      }
      return <Box />;
    },
    [sendAddress, networkId, defaultToken],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <>
        <Typography.Heading mt="24px">
          {intl.formatMessage({ id: 'content__balance' })}
        </Typography.Heading>
        <FormatBalance
          balance={totalAmount}
          suffix={symbol}
          formatOptions={{
            fixed:
              (defaultToken?.address
                ? network?.tokenDisplayDecimals
                : network?.nativeDisplayDecimals) ?? 4,
          }}
          render={(ele) => (
            <Typography.DisplayXLarge>{ele}</Typography.DisplayXLarge>
          )}
        />

        <Typography.Body2 mt="4px" mb="24px" color="text-subdued">
          <FormatCurrencyNumber value={new B(totalAmount).times(price)} />
        </Typography.Body2>
        {!isVerticalLayout ? (
          <ListItem py={4} mx="-8px">
            <ListItem.Column
              flex={3}
              text={{
                label: intl.formatMessage({
                  id: 'form__position_uppercase',
                }),
                labelProps: {
                  typography: 'Subheading',
                  color: 'text-subdued',
                },
              }}
            />
            <ListItem.Column
              flex={1}
              text={{
                label: intl.formatMessage({
                  id: 'content__type',
                }),
                labelProps: {
                  typography: 'Subheading',
                  color: 'text-subdued',
                  textAlign: 'right',
                },
              }}
            />
            <ListItem.Column
              flex={2.5}
              text={{
                label: intl.formatMessage({
                  id: 'content__balance',
                }),
                labelProps: {
                  typography: 'Subheading',
                  color: 'text-subdued',
                  textAlign: 'right',
                },
              }}
            />
            <ListItem.Column
              flex={2.5}
              text={{
                label: intl.formatMessage({
                  id: 'form__value_uppercase',
                }),
                labelProps: {
                  typography: 'Subheading',
                  color: 'text-subdued',
                  textAlign: 'right',
                },
              }}
            />
          </ListItem>
        ) : null}
      </>
    ),
    [
      intl,
      isVerticalLayout,
      network?.nativeDisplayDecimals,
      network?.tokenDisplayDecimals,
      price,
      totalAmount,
      symbol,
      defaultToken,
    ],
  );

  const ListFooterComponent = useMemo(() => <DefiListWithToken />, []);

  return (
    <Tabs.FlatList
      contentContainerStyle={{
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: isVerticalLayout ? 16 : 32,
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => item.type}
    />
  );
};

export default AssetsInfo;
