import { isNil } from 'lodash';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { buildCrossHooksWithOptions } from './buildCrossHooks';

export const {
  use: useShouldHideInscriptions,
  get: getShouldHideInscriptions,
} = buildCrossHooksWithOptions<
  boolean,
  {
    accountId: string;
    networkId: string;
  }
>((selector, { options }) => {
  const { hideInscriptions } = selector((s) => s.settings);
  const { accountId, networkId } = options;

  let shouldHideInscriptions = false;

  if (networkId === OnekeyNetwork.btc || networkId === OnekeyNetwork.tbtc) {
    const state = hideInscriptions?.[accountId];

    if (isNil(state)) {
      // taproot and native segwit enable inscriptions by default
      if (accountId?.includes(`m/86'/`) || accountId?.includes(`m/84'/`)) {
        shouldHideInscriptions = false;
      } else {
        shouldHideInscriptions = true;
      }
    } else {
      shouldHideInscriptions = state;
    }
  }

  return shouldHideInscriptions;
});
