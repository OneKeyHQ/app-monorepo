// cspell: words unifold Unifold
import { useRoute } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { showUnifoldExecutionDetailDialog } from './showUnifoldDepositModals';
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
        <UnifoldTransferContent
          expectedRecipient={route.params?.expectedRecipient}
          onPressExecution={showUnifoldExecutionDetailDialog}
        />
      </Page.Body>
    </Page>
  );
}
