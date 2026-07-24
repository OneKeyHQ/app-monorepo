// cspell: words unifold Unifold
import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/native';

import { NavBackButton, Page } from '@onekeyhq/components';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../../PerpDialogLayout';

import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTransferModal() {
  const [detailExecutionId, setDetailExecutionId] = useState<string | null>(
    null,
  );
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTransfer
      >
    >();
  const closeDetail = useCallback(() => {
    setDetailExecutionId(null);
  }, []);
  const renderDetailHeaderLeft = useCallback(
    () => <NavBackButton onPress={closeDetail} />,
    [closeDetail],
  );

  return (
    <Page scrollEnabled safeAreaEnabled>
      {detailExecutionId ? (
        <Page.Header
          title="Deposit Details"
          headerLeft={renderDetailHeaderLeft}
        />
      ) : (
        <Page.Header title="Transfer Crypto" />
      )}
      <Page.Body px="$4" {...PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}>
        {/* The page scrolls, so an absolute overlay would ride the content
            instead of the screen — the cards go in the page footer here. */}
        <UnifoldTransferContent
          expectedRecipient={route.params?.expectedRecipient}
          statusCardsPlacement="pageFooter"
          useExternalHeader
          detailExecutionId={detailExecutionId}
          onDetailExecutionIdChange={setDetailExecutionId}
        />
      </Page.Body>
    </Page>
  );
}
