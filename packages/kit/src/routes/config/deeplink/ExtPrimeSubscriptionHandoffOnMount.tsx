import { memo, useEffect } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { whenAppUnlocked } from '../../../utils/passwordUtils';

import {
  consumePrimeCardCheckoutHandoffFromUrl,
  consumePrimeSubscriptionHandoffFromUrl,
} from './primeSubscriptionExtHandoff';

import type { IPrimeCardCheckoutHandoff } from './primeSubscriptionExtHandoff';
import type { IntlShape } from 'react-intl';

// Nothing is charged automatically: the user confirms the plan again, or
// after a failed embedded checkout pays on the hosted page opened here.
async function continuePrimeCardCheckout({
  handoff: { selectedSubscriptionPeriod, featureName, currency, fallbackFrom },
  intl,
}: {
  handoff: IPrimeCardCheckoutHandoff;
  intl: IntlShape;
}) {
  await whenAppUnlocked();
  const navigation = appGlobals.$rootAppNavigation;
  navigation?.pushModal(EModalRoutes.PrimeModal, {
    screen: EPrimePages.PrimeDashboard,
    params: {
      selectedSubscriptionPeriod,
      fromFeature: featureName,
    },
  });
  if (!fallbackFrom) {
    return;
  }
  const { isLoggedIn, onekeyUserId, email } =
    await backgroundApiProxy.servicePrime.getLocalUserInfo();
  const { startPrimeHostedCardCheckout } =
    await import('../../../views/Prime/hooks/primeHostedCardCheckout');
  await startPrimeHostedCardCheckout({
    intl,
    onekeyUserId: isLoggedIn ? onekeyUserId : undefined,
    email,
    selectedSubscriptionPeriod,
    currency,
    featureName,
    fallbackFrom,
  });
}

function ExtPrimeSubscriptionHandoffOnMountCmp() {
  const intl = useIntl();

  // Bootstrap only mounts this in the expand tab.
  useEffect(() => {
    const runPendingHandoff = () => {
      const cardCheckoutHandoff = consumePrimeCardCheckoutHandoffFromUrl();
      if (cardCheckoutHandoff) {
        void (async () => {
          await timerUtils.wait(600);
          await continuePrimeCardCheckout({
            handoff: cardCheckoutHandoff,
            intl,
          });
        })();
        return;
      }
      if (!consumePrimeSubscriptionHandoffFromUrl()) {
        return;
      }
      void (async () => {
        await timerUtils.wait(600);
        const { handleDeepLinkUrl } = await import('.');
        handleDeepLinkUrl({
          url: uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.prime_subscription,
          }),
        });
      })();
    };

    runPendingHandoff();
    globalThis.addEventListener('hashchange', runPendingHandoff);
    return () => {
      globalThis.removeEventListener('hashchange', runPendingHandoff);
    };
  }, [intl]);

  return null;
}

export const ExtPrimeSubscriptionHandoffOnMount = memo(
  ExtPrimeSubscriptionHandoffOnMountCmp,
);
