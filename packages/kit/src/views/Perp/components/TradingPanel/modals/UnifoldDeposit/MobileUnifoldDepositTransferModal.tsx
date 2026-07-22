// cspell: words unifold Unifold
import { useRoute } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTransferModal() {
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTransfer
      >
    >();
  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="Transfer Crypto" />
      <Page.Body px="$4" pb="$4">
        {/* The page scrolls, so an absolute overlay would ride the content
            instead of the screen — the cards go in the page footer here. */}
        <UnifoldTransferContent
          expectedRecipient={route.params?.expectedRecipient}
          statusCardsPlacement="pageFooter"
        />
      </Page.Body>
    </Page>
  );
}
