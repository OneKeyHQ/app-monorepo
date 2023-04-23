import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
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
import StakingCell from './Cells/StakingCell';
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
  const [totalAmount, updateTotalAmount] = useState<B>(new B(0));

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
        updateTotalAmount(new B(amount));
      });
  }, [accountId, networkId, sendAddress, serviceToken, tokenId]);

  const listData = useMemo(() => [{ type: 'token' }, { type: 'staking' }], []);

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
      if (item.type === 'staking') {
        return <StakingCell tokenId={tokenId} token={token} />;
      }
      return <Box />;
    },
    [sendAddress, token, tokenId],
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
          <FormatCurrencyNumber value={totalAmount.times(price)} />
        </Typography.Body2>
      </>
    ),
    [
      intl,
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
