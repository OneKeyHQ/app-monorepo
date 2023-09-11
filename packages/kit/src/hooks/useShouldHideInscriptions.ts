import { useEffect, useState } from 'react';

import { isNil } from 'lodash';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { useAccount } from './useAccount';
import { useAppSelector } from './useAppSelector';

function useShouldHideInscriptions({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const [shouldHideInscriptions, setShouldHideInscriptions] = useState(false);
  const { hideInscriptions } = useAppSelector((state) => state.settings);
  const { account } = useAccount({ accountId, networkId });

  useEffect(() => {
    if (networkId === OnekeyNetwork.btc || networkId === OnekeyNetwork.tbtc) {
      const state = hideInscriptions?.[accountId];

      if (isNil(state)) {
        // taproot and native segwit enable inscriptions by default
        if (
          account &&
          (account.path.startsWith(`m/86'/`) ||
            account.path.startsWith(`m/84'/`))
        ) {
          setShouldHideInscriptions(false);
        } else {
          setShouldHideInscriptions(true);
        }
      } else {
        setShouldHideInscriptions(state);
      }
    }
  }, [account, accountId, hideInscriptions, networkId]);

  return shouldHideInscriptions;
}

export { useShouldHideInscriptions };
