import type { FC } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Image,
  ListItem,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import KeleLogoPNG from '@onekeyhq/kit/assets/staking/kele_pool.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../../components/Format';
import { useNavigation } from '../../../../hooks';
import { useSimpleTokenPriceValue } from '../../../../hooks/useManegeTokenPrice';
import { useTokenSupportStakedAssets } from '../../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import {
  useAccountStakingActivity,
  useKeleMinerOverview,
} from '../../../Staking/hooks';
import { StakingRoutes } from '../../../Staking/typing';
import { isSupportStakedAssets } from '../../../Staking/utils';
import { formatAmount } from '../../../Swap/utils';

export type Props = {
  networkId: string;
  tokenId: string;
  token: TokenDO | undefined;
};

type CellProps = {
  onPress: () => void;
  token: TokenDO | undefined;
  tokenValue: number;
  amount: number;
};

const Mobile: FC<CellProps> = ({ onPress, token, amount, tokenValue }) => {
  const intl = useIntl();

  return (
    <ListItem mx="-8px" onPress={onPress}>
      <ListItem.Column image={{ source: KeleLogoPNG, w: '40px', h: '40px' }} />
      <ListItem.Column
        text={{
          label: 'Kelepool',
          labelProps: { typography: 'Body1Strong' },
          description: (
            <FormatBalance
              balance={formatAmount(amount, 6)}
              suffix={token?.symbol}
              formatOptions={{
                fixed: token?.decimals ?? 4,
              }}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          ),
        }}
      />

      <ListItem.Column
        flex={1}
        alignItems="flex-end"
        text={{
          label: (
            <Typography.Body1Strong>
              <FormatCurrencyNumber value={tokenValue} />
            </Typography.Body1Strong>
          ),
          description: (
            <Box>
              <Badge
                size="sm"
                type="info"
                title={intl.formatMessage({ id: 'form__staking' })}
              />
            </Box>
          ),
        }}
      />
    </ListItem>
  );
};

const Desktop: FC<CellProps> = ({ onPress, token, amount, tokenValue }) => {
  const intl = useIntl();

  return (
    <>
      <Box borderBottomWidth={1} borderColor="divider" />
      <ListItem mx="-8px" py={4} onPress={onPress}>
        <HStack flex={3} space="12px" alignItems="center">
          <Image source={KeleLogoPNG} w="32px" h="32px" />
          <Typography.Body1Strong>Kelepool</Typography.Body1Strong>
        </HStack>

        <Box flex={1} flexDirection="row" justifyContent="flex-end">
          <Badge
            size="sm"
            type="info"
            title={intl.formatMessage({ id: 'form__staking' })}
          />
        </Box>
        <ListItem.Column
          flex={2.5}
          text={{
            label: (
              <FormatBalance
                balance={formatAmount(amount, 6)}
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
                <FormatCurrencyNumber value={tokenValue} />
              </Typography.Body1Strong>
            ),
          }}
        />
      </ListItem>
    </>
  );
};

const StakingCell: FC<Props> = ({ token, tokenId }) => {
  const { networkId, accountId } = useActiveWalletAccount();
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const navigation = useNavigation();
  const stakedSupport = useTokenSupportStakedAssets(networkId, tokenId);
  const isVerticalLayout = useIsVerticalLayout();

  const amount = useMemo(
    () =>
      Number(minerOverview?.amount?.total_amount ?? 0) +
      Number(minerOverview?.amount.withdrawable ?? 0),
    [minerOverview],
  );
  const { serviceStaking } = backgroundApiProxy;

  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnKele,
        params: {
          networkId,
        },
      },
    });
  }, [navigation, networkId]);

  const activeStakingActivity = useAccountStakingActivity(networkId, accountId);
  const price =
    useSimpleTokenPriceValue({
      networkId,
      contractAdress: tokenId,
    }) ?? 0;

  const tokenValue = useMemo(() => {
    if (price === null) return 0;
    return new B(amount).times(price).toNumber() || 0;
  }, [amount, price]);

  useEffect(() => {
    if (stakedSupport) {
      serviceStaking.fetchMinerOverview({ networkId, accountId });
    }
  }, [accountId, networkId, serviceStaking, stakedSupport, tokenId]);

  if (!stakedSupport || (amount === 0 && !activeStakingActivity)) {
    return null;
  }
  const props = {
    onPress,
    amount,
    tokenValue,
    token,
  };
  return isVerticalLayout ? <Mobile {...props} /> : <Desktop {...props} />;
};

const StakingCellControl: FC<Props> = ({ token, tokenId, networkId }) => {
  const isSupported = isSupportStakedAssets(
    token?.networkId,
    token?.tokenIdOnNetwork,
  );
  return isSupported ? (
    <StakingCell token={token} tokenId={tokenId} networkId={networkId} />
  ) : null;
};

export default StakingCellControl;
