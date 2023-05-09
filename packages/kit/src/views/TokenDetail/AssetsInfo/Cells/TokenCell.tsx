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
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import { FormatBalance } from '../../../../components/Format';
import { useAccountTokensBalance } from '../../../../hooks';
import { useSingleToken } from '../../../../hooks/useTokens';
import { PriceCurrencyNumber } from '../../TokenDetailHeader/PriceCurrencyNumber';

import type { TokenBalanceValue } from '../../../../store/reducers/tokens';

type Props = {
  sendAddress?: string;
  tokenId: string;
  token: TokenDO | undefined;
};

type CellProps = {
  token: TokenDO | undefined;
  networkId: string;
  formatedBalance: JSX.Element;
  balances: Record<string, TokenBalanceValue>;
};

const Mobile: FC<CellProps> = ({
  formatedBalance,
  token,
  balances,
  networkId,
}) => {
  const intl = useIntl();

  return (
    <ListItem mx="-8px">
      <ListItem.Column>
        {token && (
          <Token
            flex="1"
            size="40px"
            showInfo
            token={token}
            showExtra={false}
            description={formatedBalance}
            infoBoxProps={{ flex: 1 }}
          />
        )}
      </ListItem.Column>
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

const Desktop: FC<CellProps> = ({
  formatedBalance,
  token,
  balances,
  networkId,
}) => {
  const intl = useIntl();

  return (
    <>
      <Box borderBottomWidth={1} borderColor="divider" />
      <ListItem mx="-8px" py={4}>
        {token && (
          <Token
            flex={3}
            size="32px"
            showInfo
            showDescription={false}
            token={token}
            showExtra={false}
            infoBoxProps={{ flex: 1 }}
          />
        )}
        <Box flex={1} flexDirection="row" justifyContent="flex-end">
          <Badge
            size="sm"
            type="info"
            title={intl.formatMessage({ id: 'form__token' })}
          />
        </Box>
        <ListItem.Column
          flex={2.5}
          text={{
            label: (
              <Typography.Body1Strong textAlign="right">
                {formatedBalance}
              </Typography.Body1Strong>
            ),
          }}
        />
        <ListItem.Column
          flex={2.5}
          text={{
            label: (
              <Typography.Body1Strong textAlign="right">
                <PriceCurrencyNumber
                  networkId={networkId}
                  token={token}
                  contractAdress={token?.tokenIdOnNetwork}
                  balances={balances}
                />
              </Typography.Body1Strong>
            ),
          }}
        />
      </ListItem>
    </>
  );
};

const TokenCell: FC<Props> = ({ tokenId, sendAddress }) => {
  const { network, networkId, accountId } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(networkId, accountId);
  const { token } = useSingleToken(networkId, tokenId);
  const isVerticalLayout = useIsVerticalLayout();

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
      />
    );
  }, [
    amount,
    network?.nativeDisplayDecimals,
    network?.tokenDisplayDecimals,
    token?.symbol,
    token?.tokenIdOnNetwork,
  ]);

  const props = {
    formatedBalance,
    balances,
    networkId,
    token,
  };
  return isVerticalLayout ? <Mobile {...props} /> : <Desktop {...props} />;
};

export default TokenCell;
