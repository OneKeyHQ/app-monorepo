import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import B from 'bignumber.js';

import {
  Badge,
  Box,
  ListItem,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../../components/Format';
import { useActiveWalletAccount, useNavigation } from '../../../../hooks';
import { useCurrentFiatValue } from '../../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { OverviewModalRoutes } from '../../../Overview/types';

import type {
  IOverviewDeFiPortfolioItem,
  OverviewDeFiPoolType,
} from '../../../Overview/types';

type Props = {
  protocolId: string;
  item: IOverviewDeFiPortfolioItem;
  tokenId: string;
  token: TokenDO | undefined;
};

type CellProps = {
  onPress: () => void;
  item: IOverviewDeFiPortfolioItem;
  amount: number;
  tokenValue: B;
  token: TokenDO | undefined;
  poolType: OverviewDeFiPoolType;
};

const Mobile: FC<CellProps> = ({
  item,
  onPress,
  tokenValue,
  amount,
  token,
  poolType,
}) => (
  <ListItem mx="-8px" onPress={onPress}>
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
          <FormatBalance
            balance={amount}
            suffix={token?.symbol}
            formatOptions={{
              fixed: token?.decimals ?? 4,
            }}
            render={(ele) => (
              <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
            )}
          />
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

const Desktop: FC<CellProps> = ({
  item,
  onPress,
  tokenValue,
  amount,
  token,
  poolType,
}) => (
  <>
    <Box borderBottomWidth={1} borderColor="divider" />

    <ListItem mx="-8px" py={4} onPress={onPress}>
      <Token
        flex={3}
        size="32px"
        showInfo
        infoBoxProps={{ flex: 1 }}
        token={{
          logoURI: item.protocolIcon,
          name: item.protocolName,
        }}
      />
      <Box flex={1} flexDirection="row" justifyContent="flex-end">
        <Badge size="sm" type="info" title={poolType} />
      </Box>
      <ListItem.Column
        flex={2.5}
        text={{
          label: (
            <FormatBalance
              balance={amount}
              suffix={token?.symbol}
              formatOptions={{
                fixed: token?.decimals ?? 4,
              }}
              render={(ele) => (
                <Typography.Body1Strong textAlign="right">
                  {ele}
                </Typography.Body1Strong>
              )}
            />
          ),
        }}
      />
      <ListItem.Column
        flex={2.5}
        text={{
          label: (
            <Typography.Body1Strong textAlign="right">
              <FormatCurrencyNumber value={tokenValue} decimals={2} />
            </Typography.Body1Strong>
          ),
        }}
      />
    </ListItem>
  </>
);

const DefiCell: FC<Props> = ({ item, tokenId, token, protocolId }) => {
  const isVerticalLayout = useIsVerticalLayout();
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

  const onPress = useCallback(() => {
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
  }, [
    account?.address,
    accountId,
    item.poolCode,
    navigation,
    networkId,
    protocolId,
  ]);

  const props = {
    item,
    onPress,
    amount,
    tokenValue,
    poolType,
    token,
  };
  return isVerticalLayout ? <Mobile {...props} /> : <Desktop {...props} />;
};

export default DefiCell;
