import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';

import { Badge, Box, ListItem, Token, Typography } from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useActiveWalletAccount, useNavigation } from '../../../../hooks';
import { useCurrentFiatValue } from '../../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { OverviewModalRoutes } from '../../../Overview/types';

import type { IOverviewDeFiPortfolioItem } from '../../../Overview/types';

type Props = {
  protocolId: string;
  item: IOverviewDeFiPortfolioItem;
  tokenId: string;
  token: TokenDO | undefined;
};
const DefiCell: FC<Props> = ({ item, tokenId, token, protocolId }) => {
  const { poolType, supplyTokens, rewardTokens } = item;
  const fiat = useCurrentFiatValue();
  const navigation = useNavigation();
  const { networkId, accountId, account } = useActiveWalletAccount();

  const { amount, tokenValue } = useMemo(() => {
    const supplyToken = supplyTokens.find((t) => t.tokenAddress === tokenId);
    const rewardToken = rewardTokens.find((t) => t.tokenAddress === tokenId);
    const v = new B(supplyToken?.value ?? 0)
      .plus(rewardToken?.value ?? 0)
      .multipliedBy(fiat);
    const a = new B(supplyToken?.balanceParsed ?? 0)
      .plus(rewardToken?.balanceParsed ?? 0)
      .toNumber();
    return { amount: a, tokenValue: v };
  }, [supplyTokens, rewardTokens, fiat, tokenId]);

  return (
    <ListItem
      mx="-8px"
      onPress={() => {
        console.log('item = ', item);
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Overview,
          params: {
            screen: OverviewModalRoutes.OverviewProtocolDetail,
            params: {
              protocolId,
              networkId,
              address: account?.address ?? '',
              accountId,
              poolCode: item.poolCode,
            },
          },
        });
      }}
    >
      <ListItem.Column>
        <Token
          flex="1"
          size="40px"
          showInfo
          infoBoxProps={{ flex: 1 }}
          token={{
            logoURI: item.protocolIcon,
            name: item.protocolName,
          }}
          description={
            <Typography.Body2 color="text-subdued">
              {`${amount} ${token?.symbol ?? ''}`}
            </Typography.Body2>
          }
        />
      </ListItem.Column>
      <ListItem.Column
        flex={1}
        alignItems="flex-end"
        text={{
          label: (
            <Typography.Body1Strong>
              <FormatCurrencyNumber value={tokenValue} decimals={2} />
            </Typography.Body1Strong>
          ),
          description: (
            <Box>
              <Badge size="sm" type="info" title={poolType} />
            </Box>
          ),
        }}
      />
    </ListItem>
  );
};

export default DefiCell;
