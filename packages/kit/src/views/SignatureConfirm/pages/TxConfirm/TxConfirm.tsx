import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { find } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSignatureConfirmActions,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { calculateTxExtraFee } from '@onekeyhq/kit/src/utils/gasFee';
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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';

import { DAppSiteMark } from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import { TxConfirmActions } from '../../components/SignatureConfirmActions';
import { TxAdvancedSettings } from '../../components/SignatureConfirmAdvanced';
import { TxConfirmAlert } from '../../components/SignatureConfirmAlert';
import { TxConfirmDetails } from '../../components/SignatureConfirmDetails';
import { TxConfirmExtraInfo } from '../../components/SignatureConfirmExtraInfo';
import { TxConfirmHeaderRight } from '../../components/SignatureConfirmHeader';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';
import StakingInfo from '../../components/StakingInfo';
import SwapInfo from '../../components/SwapInfo';
import { usePreCheckTokenBalance } from '../../hooks/usePreCheckTokenBalance';

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
    updateSendFeeStatus,
    updateExtraFeeInfo,
  } = useSignatureConfirmActions().current;

  const [settings] = useSettingsPersistAtom();
  const [reactiveUnsignedTxs] = useUnsignedTxsAtom();
  const decodedTxsInit = useRef(false);
  const txConfirmParamsInit = useRef(false);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { urlSecurityInfo } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
  });

  const { result: decodedTxs, isLoading: isBuildingDecodedTxs } =
    usePromiseResult(
      async () => {
        updateDecodedTxs({
          isBuildingDecodedTxs: true,
        });

        if (!reactiveUnsignedTxs || reactiveUnsignedTxs.length === 0) {
          return [];
        }
        const r =
          await backgroundApiProxy.serviceSignatureConfirm.buildDecodedTxs({
            accountId,
            networkId,
            unsignedTxs: reactiveUnsignedTxs,
            transferPayload,
          });

        let extraFeeNativeTotal = new BigNumber(0);
        for (const decodedTx of r) {
          const extraFeeNative = calculateTxExtraFee({ decodedTx });
          extraFeeNativeTotal = extraFeeNativeTotal.plus(extraFeeNative);
        }

        updateExtraFeeInfo({ feeNative: extraFeeNativeTotal.toFixed() });

        updateDecodedTxs({
          decodedTxs: r,
          isBuildingDecodedTxs: false,
        });

        decodedTxsInit.current = true;

        return r;
      },
      [
        updateDecodedTxs,
        reactiveUnsignedTxs,
        accountId,
        networkId,
        transferPayload,
        updateExtraFeeInfo,
      ],
      {
        watchLoading: true,
      },
    );

  usePromiseResult(async () => {
    if (txConfirmParamsInit.current) return;
    updateNativeTokenInfo({
      isLoading: true,
      balance: '0',
      logoURI: '',
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
    const tokenResp = await backgroundApiProxy.serviceToken.fetchTokensDetails({
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
    txConfirmParamsInit.current = true;
  }, [
    accountId,
    networkId,
    settings.inscriptionProtection,
    unsignedTxs,
    updateNativeTokenInfo,
    updatePreCheckTxStatus,
  ]);

  const txConfirmTitle = useMemo(() => {
    if ((!decodedTxs || decodedTxs.length === 0) && !decodedTxsInit.current) {
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
  }, [decodedTxs, intl]);

  const swapInfo = useMemo(() => {
    const swapTx = find(unsignedTxs, 'swapInfo');
    return swapTx?.swapInfo;
  }, [unsignedTxs]);

  const stakingInfo = useMemo(() => {
    const stakingTx = find(unsignedTxs, 'stakingInfo');
    return stakingTx?.stakingInfo;
  }, [unsignedTxs]);

  const handleOnClose = (extra?: { flag?: string }) => {
    if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
      dappApprove.reject();
    }
  };

  usePreCheckTokenBalance({
    networkId,
    transferPayload,
  });

  useEffect(() => {
    updateUnsignedTxs(unsignedTxs);
    appEventBus.emit(
      EAppEventBusNames.SignatureConfirmContainerMounted,
      undefined,
    );
    return () => {
      updateSendFeeStatus({ status: ESendFeeStatus.Idle, errMessage: '' });
    };
  }, [unsignedTxs, updateSendFeeStatus, updateUnsignedTxs]);

  useEffect(() => {
    if (sourceInfo) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId,
      });
      void backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId,
      });
    }
  }, [sourceInfo, accountId]);

  const renderTxConfirmContent = useCallback(() => {
    if ((isBuildingDecodedTxs || !decodedTxs) && !decodedTxsInit.current) {
      return <SignatureConfirmLoading />;
    }

    return (
      <YStack gap="$5">
        <TxConfirmAlert
          networkId={networkId}
          accountId={accountId}
          transferPayload={transferPayload}
        />
        {sourceInfo?.origin ? (
          <DAppSiteMark
            origin={sourceInfo.origin}
            urlSecurityInfo={urlSecurityInfo}
          />
        ) : null}
        <TxConfirmDetails accountId={accountId} networkId={networkId} />
        <TxConfirmExtraInfo
          accountId={accountId}
          networkId={networkId}
          unsignedTxs={unsignedTxs}
        />
        {swapInfo ? <SwapInfo data={swapInfo} /> : null}
        {stakingInfo ? <StakingInfo data={stakingInfo} /> : null}
        <TxAdvancedSettings accountId={accountId} networkId={networkId} />
      </YStack>
    );
  }, [
    isBuildingDecodedTxs,
    decodedTxs,
    networkId,
    accountId,
    transferPayload,
    sourceInfo?.origin,
    urlSecurityInfo,
    unsignedTxs,
    swapInfo,
    stakingInfo,
  ]);

  const renderHeaderRight = useCallback(
    () => (
      <TxConfirmHeaderRight decodedTxs={decodedTxs} unsignedTxs={unsignedTxs} />
    ),
    [decodedTxs, unsignedTxs],
  );

  return (
    <Page scrollEnabled onClose={handleOnClose} safeAreaEnabled>
      <Page.Header title={txConfirmTitle} headerRight={renderHeaderRight} />
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
