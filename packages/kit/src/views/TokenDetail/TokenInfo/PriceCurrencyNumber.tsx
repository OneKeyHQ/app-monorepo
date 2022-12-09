import { FC } from 'react';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useSimpleTokenPriceValue } from '../../../hooks/useManegeTokenPrice';
import { TokenBalanceValue } from '../../../store/reducers/tokens';
import { Token } from '../../../store/typings';
import { getTokenValue } from '../../../utils/priceUtils';

export const PriceCurrencyNumber: FC<{
  networkId: string;
  balances: Record<string, TokenBalanceValue>;
  contractAdress?: string;
  token?: Token | null;
}> = ({ networkId, balances, contractAdress, token }) => {
  const price = useSimpleTokenPriceValue({ networkId, contractAdress });
  return (
    <FormatCurrencyNumber
      value={getTokenValue({
        token,
        price,
        balances,
      })}
    />
  );
};
