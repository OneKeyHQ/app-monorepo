import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Skeleton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';

import TxConfirmActions from '../../components/SignatureConfirmActions';
import { TxAdvancedSettings } from '../../components/SignatureConfirmAdvanced';
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

  const {
    updateDecodedTxs,
    updateUnsignedTxs,
    updateNativeTokenInfo,
    updatePreCheckTxStatus,
  } = useSignatureConfirmActions().current;

  const [settings] = useSettingsPersistAtom();

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

        updateUnsignedTxs(unsignedTxs);
        updateNativeTokenInfo({
          isLoading: true,
          balance: '0',
          logoURI: '',
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

        const nativeTokenAddress =
          await backgroundApiProxy.serviceToken.getNativeTokenAddress({
            networkId,
          });

        try {
          await backgroundApiProxy.serviceSend.precheckUnsignedTxs({
            networkId,
            accountId,
            unsignedTxs,
            precheckTiming: ESendPreCheckTimingEnum.BeforeTransaction,
          });
        } catch (e: any) {
          updatePreCheckTxStatus((e as Error).message);
        }
        const checkInscriptionProtectionEnabled =
          await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
            {
              networkId,
              accountId,
            },
          );
        const withCheckInscription =
          checkInscriptionProtectionEnabled && settings.inscriptionProtection;
        const tokenResp =
          await backgroundApiProxy.serviceToken.fetchTokensDetails({
            networkId,
            accountId,
            contractList: [nativeTokenAddress],
            withFrozenBalance: true,
            withCheckInscription,
          });
        const balance = tokenResp?.[0]?.balanceParsed;
        updateNativeTokenInfo({
          isLoading: false,
          balance,
          logoURI: tokenResp?.[0]?.info.logoURI ?? '',
        });

        return r;
      },
      [
        updateDecodedTxs,
        updateUnsignedTxs,
        unsignedTxs,
        updateNativeTokenInfo,
        networkId,
        accountId,
        settings.inscriptionProtection,
        transferPayload,
        updatePreCheckTxStatus,
      ],
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
        <TxAdvancedSettings
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
      <TxConfirmActions {...route.params} />
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
