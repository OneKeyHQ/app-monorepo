// cspell: words unifold Unifold
import { useRoute } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { UnifoldTrackerContent } from './UnifoldTrackerContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTrackerModal() {
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTracker
      >
    >();
  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="Deposit Tracker" />
      <Page.Body px="$4" pb="$4">
        <UnifoldTrackerContent
          recipientAddress={route.params?.expectedRecipient ?? null}
          listHeight={9999}
        />
      </Page.Body>
    </Page>
  );
}
