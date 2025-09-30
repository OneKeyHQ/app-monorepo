import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import { usePerpsActiveAccountSummaryAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function useMMR(): BigNumber | null {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();

  const mmr = useMemo(() => {
    if (
      !accountSummary?.crossMaintenanceMarginUsed ||
      !accountSummary?.crossAccountValue
    ) {
      return null;
    }

    const maintenanceMarginUsed = new BigNumber(
      accountSummary.crossMaintenanceMarginUsed,
    );
    const accountValue = new BigNumber(accountSummary.crossAccountValue);

    // Avoid division by zero
    if (accountValue.isZero()) {
      return null;
    }

    return maintenanceMarginUsed.dividedBy(accountValue);
  }, [
    accountSummary?.crossMaintenanceMarginUsed,
    accountSummary?.crossAccountValue,
  ]);

  return mmr;
}
