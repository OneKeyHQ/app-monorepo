import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Skeleton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';

import SignatureConfirmDetails from '../../components/SignatureConfirmDetails';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';

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

  const { updateDecodedTxs } = useSignatureConfirmActions().current;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { result: decodedTxs, isLoading: isBuildingDecodedTxs } =
    usePromiseResult(
      async () => {
        updateDecodedTxs({
          decodedTxs: [],
          isBuildingDecodedTxs: true,
        });
        const r = await Promise.all(
          unsignedTxs.map((unsignedTx) =>
            backgroundApiProxy.serviceSignatureConfirm.buildDecodedTx({
              accountId,
              networkId,
              unsignedTx,
              transferPayload,
            }),
          ),
        );
        updateDecodedTxs({
          decodedTxs: r,
          isBuildingDecodedTxs: false,
        });

        return r;
      },
      [updateDecodedTxs, unsignedTxs, accountId, networkId, transferPayload],
      {
        watchLoading: true,
      },
    );

  const txConfirmTitle = useMemo(() => {
    if (isBuildingDecodedTxs) {
      return '';
    }

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
  }, [decodedTxs, intl, isBuildingDecodedTxs]);

  const handleTxConfirmOnClose = useCallback(() => {
    dappApprove.reject();
  }, [dappApprove]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.SendConfirmContainerMounted, undefined);
  }, []);

  const renderTxConfirmContent = useCallback(() => {
    if (isBuildingDecodedTxs || !decodedTxs) {
      return <Skeleton height="$3" width="$12" />;
    }

    return (
      <>
        <SignatureConfirmDetails
          accountId={accountId}
          networkId={networkId}
          decodedTxs={decodedTxs}
        />
      </>
    );
  }, [isBuildingDecodedTxs, decodedTxs, accountId, networkId]);

  return (
    <Page scrollEnabled onClose={handleTxConfirmOnClose} safeAreaEnabled>
      <Page.Header title={txConfirmTitle} />
      <Page.Body testID="tx-confirmation-body" px="$5">
        {renderTxConfirmContent()}
      </Page.Body>
    </Page>
  );
}

const TxConfirmWithProvider = memo(() => (
  <SignatureConfirmProviderMirror>
    <TxConfirm />
  </SignatureConfirmProviderMirror>
));
TxConfirmWithProvider.displayName = 'TxConfirmWithProvider';

export default TxConfirmWithProvider;
