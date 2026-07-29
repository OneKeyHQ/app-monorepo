// cspell: words unifold Unifold
import { useCallback, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  type IPageNavigationProp,
  NavBackButton,
  Page,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalPerpRoutes,
  IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../../PerpDialogLayout';

import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { RouteProp } from '@react-navigation/core';

export default function MobileUnifoldDepositTransferModal() {
  const intl = useIntl();
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
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
  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const renderBackHeaderLeft = useCallback(
    () => <NavBackButton onPress={goBack} />,
    [goBack],
  );
  const clearSourceSelectorResult = useCallback(() => {
    navigation.setParams({ sourceSelectorResult: undefined });
  }, [navigation]);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: detailExecutionId
            ? ETranslations.perp_unifold_deposit_details__title
            : ETranslations.perp_unifold_transfer_crypto__title,
        })}
        headerLeft={
          detailExecutionId ? renderDetailHeaderLeft : renderBackHeaderLeft
        }
      />
      <Page.Body px="$4" {...PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}>
        {/* The page scrolls, so an absolute overlay would ride the content
            instead of the screen — the cards go in the page footer here. */}
        <UnifoldTransferContent
          expectedRecipient={route.params?.expectedRecipient}
          sourceSelectorResult={route.params?.sourceSelectorResult}
          onSourceSelectorResultHandled={clearSourceSelectorResult}
          statusCardsPlacement="pageFooter"
          useExternalHeader
          detailExecutionId={detailExecutionId}
          onDetailExecutionIdChange={setDetailExecutionId}
        />
      </Page.Body>
    </Page>
  );
}
