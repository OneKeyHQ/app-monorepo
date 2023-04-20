import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  ListItem,
  Skeleton,
  Token,
  Typography,
} from '@onekeyhq/components';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import { FormatBalance } from '../../../../components/Format';
import { useAccountTokensBalance } from '../../../../hooks';
import { useSingleToken } from '../../../../hooks/useTokens';
import { PriceCurrencyNumber } from '../../TokenDetailHeader/PriceCurrencyNumber';

type Props = {
  sendAddress?: string;
  tokenId: string;
  token: TokenDO | undefined;
};
const TokenCell: FC<Props> = ({ tokenId, sendAddress }) => {
  const { network, networkId, accountId } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(networkId, accountId);
  const { token } = useSingleToken(networkId, tokenId);
  const intl = useIntl();

  const { balance: amount } = balances[
    getBalanceKey({
      ...token,
      sendAddress,
    })
  ] ?? {
    balance: '0',
  };

  const formatedBalance = useMemo(() => {
    if (typeof amount === 'undefined') {
      return <Skeleton shape="Body2" />;
    }
    return (
      <FormatBalance
        balance={amount}
        suffix={token?.symbol}
        formatOptions={{
          fixed:
            (token?.tokenIdOnNetwork
              ? network?.tokenDisplayDecimals
              : network?.nativeDisplayDecimals) ?? 4,
        }}
        render={(ele) => (
          <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
        )}
      />
    );
  }, [
    amount,
    network?.nativeDisplayDecimals,
    network?.tokenDisplayDecimals,
    token?.symbol,
    token?.tokenIdOnNetwork,
  ]);

  return (
    <ListItem mx="-8px">
      <ListItem.Column>
        {token && (
          <Token size="40px" token={token} showTokenVerifiedIcon={false} />
        )}
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: token?.name,
          labelProps: { typography: 'Body1Strong' },
          description: formatedBalance,
        }}
      />
      <ListItem.Column
        flex={1}
        alignItems="flex-end"
        text={{
          label: (
            <Typography.Body1Strong>
              <PriceCurrencyNumber
                networkId={networkId}
                token={token}
                contractAdress={token?.tokenIdOnNetwork}
                balances={balances}
              />
            </Typography.Body1Strong>
          ),
          description: (
            <Box>
              <Badge
                size="sm"
                type="info"
                title={intl.formatMessage({ id: 'form__token' })}
              />
            </Box>
          ),
        }}
      />
    </ListItem>
  );
};

export default TokenCell;
