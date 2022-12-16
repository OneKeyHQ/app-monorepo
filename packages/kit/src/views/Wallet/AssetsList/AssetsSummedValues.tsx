import { FC, useMemo } from 'react';

import { Text } from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useAppSelector } from '../../../hooks';
import { useManageTokenprices } from '../../../hooks/useManegeTokenPrice';
import { TokenBalanceValue } from '../../../store/reducers/tokens';
import { getSummedValues } from '../../../utils/priceUtils';

export const AssetsSummedValues: FC<{
  networkId: string;
  accountId: string;
  balances: Record<string, TokenBalanceValue>;
  accountTokens: Token[];
}> = ({ networkId, accountId, balances, accountTokens }) => {
  const { prices } = useManageTokenprices({ networkId, accountId });
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const summedValue = useMemo(
    () =>
      getSummedValues({
        tokens: accountTokens,
        balances,
        prices,
        vsCurrency,
        hideSmallBalance,
      }).toNumber(),
    [accountTokens, balances, hideSmallBalance, prices, vsCurrency],
  );
  return (
    <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
      {Number.isNaN(summedValue) ? (
        ' '
      ) : (
        <FormatCurrencyNumber decimals={2} value={summedValue} />
      )}
    </Text>
  );
};
