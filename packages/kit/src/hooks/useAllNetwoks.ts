import { useMemo } from 'react';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';

export const useAllNetworkAccountValue = ({
  accountId,
}: {
  accountId?: string;
}): string | undefined => {
  if (typeof accountId === 'undefined') {
    return undefined;
  }
  // TODO: real account values
  return '0';
};

export const useAllNetworkAccountInfo = ({
  accountId,
}: {
  accountId: string;
}) =>
  useMemo(() => {
    if (!allNetworksAccountRegex.test(accountId)) {
      return;
    }
    return generateFakeAllnetworksAccount({ accountId });
  }, [accountId]);
