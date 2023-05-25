import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useActiveSideAccount, useAppSelector } from '../../../hooks';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';

import DefiCell from './Cells/DefiCell';
import KeleStakingCell from './Cells/KeleStakingCell';
import LidoStakingCell from './Cells/LidoStakingCell';
import TokenCell from './Cells/TokenCell';

import type { ListRenderItem } from 'react-native';

type Props = {
  priceReady?: boolean;
  sendAddress?: string;
  tokenId: string;
  accountId: string;
  networkId: string;
  token: TokenDO | undefined;
};

const DefiListWithToken: FC<Props> = ({
  networkId,
  accountId,
  tokenId,
  token,
}) => {
  const { account } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const defis = useAppSelector(
    (s) => s.overview.defi?.[`${networkId}--${account?.address ?? ''}`] ?? [],
  );

  const genateList = useCallback(
    () =>
      defis.map((protocol) =>
        protocol.pools.map(([, items]) =>
          items
            .filter(
              ({ supplyTokens, rewardTokens }) =>
                supplyTokens.filter(
                  ({ tokenAddress }) => tokenAddress === tokenId,
                ).length > 0 ||
                rewardTokens.filter(
                  ({ tokenAddress }) => tokenAddress === tokenId,
                ).length > 0,
            )
            .map((item, index) => (
              <DefiCell
                protocolId={protocol._id.protocolId}
                token={token}
                key={`${protocol.protocolName}${item.poolType}${index}`}
                item={item}
                tokenId={tokenId}
              />
            )),
        ),
      ),
    [defis, token, tokenId],
  );

  return <VStack>{genateList()}</VStack>;
};

const AssetsInfo: FC<Props> = ({
  tokenId,
  sendAddress,
  accountId,
  networkId,
  token,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const price =
    useSimpleTokenPriceValue({
      networkId,
      contractAdress: tokenId,
    }) ?? 0;

  const { network } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const [totalAmount, updateTotalAmount] = useState<string>('0');

  const { serviceToken } = backgroundApiProxy;
  useEffect(() => {
    serviceToken
      .fetchTokenDetailAmount({
        accountId,
        networkId,
        tokenId,
        sendAddress,
      })
      .then((amount) => {
        updateTotalAmount(amount);
      });
  }, [accountId, networkId, sendAddress, serviceToken, tokenId]);

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
            tokenId={tokenId}
            token={token}
          />
        );
      }
      if (item.type === 'keleStaking') {
        return (
          <KeleStakingCell
            tokenId={tokenId}
            networkId={networkId}
            token={token}
          />
        );
      }
      if (item.type === 'lidoStaking') {
        return <LidoStakingCell token={token} sendAddress={sendAddress} />;
      }
      return <Box />;
    },
    [sendAddress, token, tokenId, networkId],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <>
        <Typography.Heading mt="24px">
          {intl.formatMessage({ id: 'content__balance' })}
        </Typography.Heading>
        <FormatBalance
          balance={totalAmount}
          suffix={token?.symbol}
          formatOptions={{
            fixed:
              (token?.tokenIdOnNetwork
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
      token?.symbol,
      token?.tokenIdOnNetwork,
      totalAmount,
    ],
  );

  const ListFooterComponent = useMemo(
    () => (
      <DefiListWithToken
        token={token}
        tokenId={tokenId}
        accountId={accountId}
        networkId={networkId}
      />
    ),
    [accountId, networkId, token, tokenId],
  );

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
    />
  );
};

export default AssetsInfo;
