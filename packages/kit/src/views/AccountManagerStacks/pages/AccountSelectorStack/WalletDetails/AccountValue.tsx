import { useMemo } from 'react';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function AccountValue(accountValue: {
  accountId: string;
  currency: string;
  value: string;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();

  const { currency, value } = useMemo(() => {
    if (
      activeAccountValue &&
      activeAccountValue?.accountId === accountValue?.accountId
    ) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue]);

  return (
    <Currency
      numberOfLines={1}
      flexShrink={1}
      size="$bodyMd"
      color="$textSubdued"
      sourceCurrency={currency}
    >
      {value}
    </Currency>
  );
}

export { AccountValue };
