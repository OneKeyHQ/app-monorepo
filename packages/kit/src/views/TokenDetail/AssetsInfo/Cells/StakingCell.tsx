import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Badge, Box, ListItem, Typography } from '@onekeyhq/components';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import KeleLogoPNG from '@onekeyhq/kit/assets/staking/kele_pool.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useSimpleTokenPriceValue } from '../../../../hooks/useManegeTokenPrice';
import { useAccountStakingActivity } from '../../../Staking/hooks';
import { useStakingAmount } from '../hook';

export type Props = {
  tokenId: string;
  token: TokenDO | undefined;
};

const StakingCell: FC<Props> = ({ token, tokenId }) => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const { amount, statedSupport } = useStakingAmount({
    networkId,
    accountId,
    tokenId,
  });

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
    <ListItem mx="-8px" onPress={() => {}}>
      <ListItem.Column image={{ source: KeleLogoPNG, w: '40px', h: '40px' }} />
      <ListItem.Column
        text={{
          label: 'Kelepool',
          labelProps: { typography: 'Body1Strong' },
          description: `${amount} ${token?.symbol ?? ''}`,
          descriptionProps: {
            typography: 'Body2',
          },
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
