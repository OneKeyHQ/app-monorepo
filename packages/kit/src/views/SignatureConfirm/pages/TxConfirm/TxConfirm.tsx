import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { find } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCustomRpcAvailability } from '@onekeyhq/kit/src/hooks/useCustomRpcAvailability';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDecodedTxsInitAtom,
  useSignatureConfirmActions,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_NATIVE_TOKEN_INFO } from '@onekeyhq/shared/src/consts/walletConsts';
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
import { calculateTxExtraFee } from '@onekeyhq/shared/src/utils/feeUtils';
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
import TaskQueueController from '../../components/TaskQueueController/TaskQueueController';
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

  const {
    transferPayload,
    sourceInfo,
    unsignedTxs,
    isQueueMode,
    unsignedTxQueue,
  } = route.params;

  const {
    updateDecodedTxs,
    updateUnsignedTxs,
    updateNativeTokenInfo,
    updatePreCheckTxStatus,
    updateSendFeeStatus,
    updateExtraFeeInfo,
    updateDecodedTxsInit,
    updateSendTxStatus,
    updateCustomRpcStatus,
  } = useSignatureConfirmActions().current;

  const [settings] = useSettingsPersistAtom();
  const [reactiveUnsignedTxs] = useUnsignedTxsAtom();
  const [decodedTxsInit] = useDecodedTxsInitAtom();
  const txConfirmParamsInit = useRef(false);
  const visitReceiveSelectorRef = useRef<boolean>(false);

  const accountId =
    reactiveUnsignedTxs?.[0]?.accountId ?? route.params.accountId;
  const networkId =
    reactiveUnsignedTxs?.[0]?.networkId ?? route.params.networkId;

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
            sourceInfo,
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

        updateDecodedTxsInit(true);

        return r;
      },
      [
        updateDecodedTxs,
        reactiveUnsignedTxs,
        accountId,
        networkId,
        transferPayload,
        sourceInfo,
        updateExtraFeeInfo,
        updateDecodedTxsInit,
      ],
      {
        watchLoading: true,
      },
    );

  useEffect(() => {
    if (accountId && networkId && reactiveUnsignedTxs?.[0]?.uuid) {
      updateSendTxStatus({
        isInsufficientNativeBalance: false,
        isInsufficientTokenBalance: false,
        fillUpNativeBalance: '0',
        isBaseOnEstimateMaxFee: false,
        maxFeeNative: '0',
      });
      updateSendFeeStatus({
        status: ESendFeeStatus.Idle,
        errMessage: '',
      });
      txConfirmParamsInit.current = false;
    }
  }, [
    txConfirmParamsInit,
    reactiveUnsignedTxs,
    updateDecodedTxsInit,
    accountId,
    networkId,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  const fetchNativeTokenInfo = useCallback(async () => {
    const nativeTokenAddress =
      await backgroundApiProxy.serviceToken.getNativeTokenAddress({
        networkId,
      });

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
      info: tokenResp?.[0]?.info,
    });
  }, [
    updateNativeTokenInfo,
    accountId,
    networkId,
    settings.inscriptionProtection,
  ]);

  usePromiseResult(
    async () => {
      if (!visitReceiveSelectorRef.current) return;
      await fetchNativeTokenInfo();
    },
    [fetchNativeTokenInfo],
    {
      pollingInterval: POLLING_INTERVAL_FOR_NATIVE_TOKEN_INFO,
    },
  );

  useEffect(() => {
    const initTxConfirmParams = async () => {
      if (txConfirmParamsInit.current) return;
      updateNativeTokenInfo({
        isLoading: true,
        balance: '0',
        logoURI: '',
        info: undefined,
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
      await fetchNativeTokenInfo();
      txConfirmParamsInit.current = true;
    };
    void initTxConfirmParams();
  }, [
    updateNativeTokenInfo,
    fetchNativeTokenInfo,
    networkId,
    accountId,
    unsignedTxs,
    updatePreCheckTxStatus,
  ]);

  // Check custom RPC status on page mount using shared hook
  const { isCustomRpcUnavailable, customRpcUrl, isCustomNetwork } =
    useCustomRpcAvailability(networkId);

  // Update custom RPC status atom when detection result changes
  useEffect(() => {
    if (isCustomRpcUnavailable && customRpcUrl && !isCustomNetwork) {
      updateCustomRpcStatus({
        isCustomRpcUnavailable: true,
        customRpcUrl,
        networkId,
      });
    } else {
      updateCustomRpcStatus(null);
    }
  }, [
    isCustomRpcUnavailable,
    customRpcUrl,
    isCustomNetwork,
    networkId,
    updateCustomRpcStatus,
  ]);

  const txConfirmTitle = useMemo(() => {
    if ((!decodedTxs || decodedTxs.length === 0) && !decodedTxsInit) {
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
  }, [decodedTxs, intl, decodedTxsInit]);

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

    const refreshNativeTokenInfo = () => {
      visitReceiveSelectorRef.current = true;
      void fetchNativeTokenInfo();
    };

    appEventBus.emit(
      EAppEventBusNames.SignatureConfirmContainerMounted,
      undefined,
    );
    appEventBus.on(
      EAppEventBusNames.RefreshNativeTokenInfo,
      refreshNativeTokenInfo,
    );
    return () => {
      updateSendFeeStatus({ status: ESendFeeStatus.Idle, errMessage: '' });
      appEventBus.off(
        EAppEventBusNames.RefreshNativeTokenInfo,
        refreshNativeTokenInfo,
      );
    };
  }, [
    isQueueMode,
    unsignedTxQueue,
    unsignedTxs,
    updateSendFeeStatus,
    updateUnsignedTxs,
    fetchNativeTokenInfo,
  ]);

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
    if ((isBuildingDecodedTxs || !decodedTxs) && !decodedTxsInit) {
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
    decodedTxsInit,
  ]);

  const renderTxQueueController = useCallback(() => {
    if (!isQueueMode) {
      return null;
    }
    return <TaskQueueController taskQueue={unsignedTxQueue} />;
  }, [isQueueMode, unsignedTxQueue]);

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
        {renderTxQueueController()}
        {renderTxConfirmContent()}
      </Page.Body>
      <TxConfirmActions
        {...route.params}
        accountId={accountId}
        networkId={networkId}
      />
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
