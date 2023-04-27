import type { FC } from 'react';
import { useEffect, useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Badge, Box, ListItem, Typography } from '@onekeyhq/components';
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

export type Props = {
  tokenId: string;
  token: TokenDO | undefined;
};

const StakingCell: FC<Props> = ({ token, tokenId }) => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const minerOverview = useKeleMinerOverview(networkId, accountId);
  const navigation = useNavigation();
  const statedSupport = useTokenSupportStakedAssets(networkId, tokenId);

  const amount = useMemo(
    () => minerOverview?.amount?.total_amount ?? 0,
    [minerOverview],
  );
  const { serviceStaking } = backgroundApiProxy;

  useEffect(() => {
    if (statedSupport) {
      serviceStaking.fetchMinerOverview({ networkId, accountId });
    }
  }, [accountId, networkId, serviceStaking, statedSupport, tokenId]);

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

  if (!statedSupport) {
    return null;
  }
  return amount > 0 || activeStakingActivity ? (
    <ListItem
      mx="-8px"
      onPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.StakedETHOnKele,
            params: {
              networkId,
            },
          },
        });
      }}
    >
      <ListItem.Column image={{ source: KeleLogoPNG, w: '40px', h: '40px' }} />
      <ListItem.Column
        text={{
          label: 'Kelepool',
          labelProps: { typography: 'Body1Strong' },
          description: (
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
  ) : null;
};

export default StakingCell;
