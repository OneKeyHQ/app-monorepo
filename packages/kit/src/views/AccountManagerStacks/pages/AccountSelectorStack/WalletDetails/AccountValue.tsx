import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function AccountValue(accountValue: {
  accountId: string;
  currency: string;
  value: string;
}) {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const isActiveAccount =
    activeAccountValue?.accountId === accountValue?.accountId;

  const { currency, value } = useMemo(() => {
    if (activeAccountValue && isActiveAccount) {
      return activeAccountValue;
    }
    return accountValue;
  }, [accountValue, activeAccountValue, isActiveAccount]);
  const intl = useIntl();

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
