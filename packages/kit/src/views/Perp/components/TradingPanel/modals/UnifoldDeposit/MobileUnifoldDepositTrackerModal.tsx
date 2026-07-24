// cspell: words unifold Unifold
import { useCallback, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import {
  type IPageNavigationProp,
  NavBackButton,
  Page,
} from '@onekeyhq/components';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../../PerpDialogLayout';

import { UnifoldTrackerContent } from './UnifoldTrackerContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTrackerModal() {
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const [detailExecutionId, setDetailExecutionId] = useState<string | null>(
    null,
  );
  const route =
    useRoute<
      RouteProp<
        IModalPerpParamList,
        EModalPerpRoutes.MobileUnifoldDepositTracker
      >
    >();
  const closeDetail = useCallback(() => {
    setDetailExecutionId(null);
  }, []);
  const renderDetailHeaderLeft = useCallback(
    () => <NavBackButton onPress={closeDetail} />,
    [closeDetail],
  );
  const expectedRecipient = route.params?.expectedRecipient;
  const handleDepositPress = useCallback(() => {
    if (!expectedRecipient) {
      return;
    }
    navigation.replace(EModalPerpRoutes.MobileUnifoldDepositTransfer, {
      expectedRecipient,
    });
  }, [expectedRecipient, navigation]);

  return (
    <Page safeAreaEnabled>
      {detailExecutionId ? (
        <Page.Header
          title="Deposit Details"
          headerLeft={renderDetailHeaderLeft}
        />
      ) : (
        <Page.Header title="Crypto Deposits" />
      )}
      <Page.Body
        px="$4"
        flex={1}
        minHeight={0}
        {...PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}
      >
        <UnifoldTrackerContent
          recipientAddress={expectedRecipient ?? null}
          fillAvailableHeight
          useExternalHeader
          detailExecutionId={detailExecutionId}
          onDetailExecutionIdChange={setDetailExecutionId}
          onDepositPress={handleDepositPress}
        />
      </Page.Body>
    </Page>
  );
}
