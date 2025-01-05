import { useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';

import SignatureConfirmAccountInfo from '../../components/SignatureConfirmAccountInfo';
import { useDecodedTxs } from '../../hooks/useDecodedTxs';

import type { RouteProp } from '@react-navigation/core';

function TxConfirm() {
  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.TxConfirm
      >
    >();

  const intl = useIntl();

  const { accountId, networkId, transferPayload, sourceInfo, unsignedTxs } =
    route.params;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { decodedTxs } = useDecodedTxs({
    accountId,
    networkId,
    unsignedTxs,
    transferPayload,
  });

  const txConfirmTitle = useMemo(() => {
    if (
      decodedTxs &&
      decodedTxs[0] &&
      decodedTxs[0].txDisplay &&
      decodedTxs[0].txDisplay.title
    ) {
      return decodedTxs[0].txDisplay.title;
    }

    return intl.formatMessage({
      id: ETranslations.transaction__transaction_confirm,
    });
  }, [decodedTxs, intl]);

  const handleTxConfirmOnClose = useCallback(() => {
    dappApprove.reject();
  }, [dappApprove]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.SendConfirmContainerMounted, undefined);
  }, []);

  return (
    <Page scrollEnabled onClose={handleTxConfirmOnClose} safeAreaEnabled>
      <Page.Header title={txConfirmTitle} />
      <Page.Body testID="tx-confirmation-body">
        <SignatureConfirmAccountInfo
          accountId={accountId}
          networkId={networkId}
        />
      </Page.Body>
    </Page>
  );
}

export default TxConfirm;
