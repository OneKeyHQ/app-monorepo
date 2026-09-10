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
  useEffectiveFeePayerAtom,
  useSignatureConfirmActions,
  useTxFeeInfoInitAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useInscriptionProtectionStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { POLLING_INTERVAL_FOR_NATIVE_TOKEN_INFO } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
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
import {
  EParseTxComponentType,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { getBorrowTxTitle } from '../../../Borrow/borrowUtils';
import {
  DAppSiteMark,
  shouldHideDAppSiteRiskStyle,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import DeFiActionInfo from '../../components/DeFiActionInfo';
import {
  SecurityCheckCard,
  TransactionPreview,
  buildSecurityCheckModel,
} from '../../components/SecurityCheckCard';
import { TxConfirmActions } from '../../components/SignatureConfirmActions';
import { TxAdvancedSettings } from '../../components/SignatureConfirmAdvanced';
import { TxConfirmAlert } from '../../components/SignatureConfirmAlert';
import { TxConfirmDetails } from '../../components/SignatureConfirmDetails';
import { TxConfirmExtraInfo } from '../../components/SignatureConfirmExtraInfo';
import {
  TxConfirmHeaderRight,
  getTxConfirmMevProtectionProvider,
} from '../../components/SignatureConfirmHeader';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';
import StakingInfo from '../../components/StakingInfo';
import SwapInfo from '../../components/SwapInfo';
import TaskQueueController from '../../components/TaskQueueController/TaskQueueController';
import { usePreCheckTokenBalance } from '../../hooks/usePreCheckTokenBalance';
import { useTransactionSecurityCheck } from '../../hooks/useTransactionSecurityCheck';
import { SignatureConfirmTestIDs } from '../../testIDs';

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
    gasAccountScenario,
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

  const [inscriptionProtectionState] = useInscriptionProtectionStateAtom();
  const [reactiveUnsignedTxs] = useUnsignedTxsAtom();
  const [decodedTxsInit] = useDecodedTxsInitAtom();
  const [effectiveFeePayer] = useEffectiveFeePayerAtom();
  const [txFeeInfoInit] = useTxFeeInfoInitAtom();
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
    walletConnectVerifyContext: sourceInfo?.walletConnectVerifyContext,
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
      updateDecodedTxs({
        decodedTxs: [],
        isBuildingDecodedTxs: false,
      });
      updateDecodedTxsInit(false);
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
        discountPercent: 0,
      });
      txConfirmParamsInit.current = false;
    }
  }, [
    txConfirmParamsInit,
    reactiveUnsignedTxs,
    updateDecodedTxs,
    updateDecodedTxsInit,
    accountId,
    networkId,
    updateSendFeeStatus,
    updateSendTxStatus,
  ]);

  const fetchNativeTokenInfo = useCallback(
    async () => {
      const nativeTokenAddress =
        await backgroundApiProxy.serviceToken.getNativeTokenAddress({
          networkId,
        });

      const withCheckInscription =
        await backgroundApiProxy.serviceSetting.getEffectiveInscriptionProtection(
          {
            networkId,
            accountId,
          },
        );
      const tokenResp =
        await backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountId,
          contractList: [nativeTokenAddress],
          withFrozenBalance: true,
          withCheckInscription,
        });
      // Coin-control txs can only spend the user-selected UTXOs, so treat the
      // selected subtotal as the spendable balance. The account-level balance
      // fetched above excludes find-address claimed UTXOs (never aggregated),
      // which would otherwise read as 0 and falsely trip the insufficient
      // native balance checks.
      const balance =
        transferPayload?.selectedUtxoTotalAmount ??
        tokenResp?.[0]?.balanceParsed;
      updateNativeTokenInfo({
        isLoading: false,
        balance,
        logoURI: tokenResp?.[0]?.info.logoURI ?? '',
        info: tokenResp?.[0]?.info,
      });
    },
    // The policy state is an intentional invalidation signal; bg computes the final value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [
      updateNativeTokenInfo,
      accountId,
      networkId,
      inscriptionProtectionState.localEnabled,
      inscriptionProtectionState.serverEnabled,
      transferPayload?.selectedUtxoTotalAmount,
    ],
  );

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

  const stakingInfo = useMemo(() => {
    const stakingTx = find(unsignedTxs, 'stakingInfo');
    return stakingTx?.stakingInfo;
  }, [unsignedTxs]);

  const txConfirmTitle = useMemo(() => {
    if ((!decodedTxs || decodedTxs.length === 0) && !decodedTxsInit) {
      return '';
    }

    if (stakingInfo?.tags?.includes(EEarnLabels.Borrow)) {
      return getBorrowTxTitle({ intl, stakingInfo });
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
  }, [decodedTxs, intl, decodedTxsInit, stakingInfo]);

  const swapInfo = useMemo(() => {
    const swapTx = find(unsignedTxs, 'swapInfo');
    return swapTx?.swapInfo;
  }, [unsignedTxs]);

  const simulationComponents = useMemo(
    () =>
      (decodedTxs ?? [])
        .flatMap((decodedTx) => decodedTx.txDisplay?.components ?? [])
        .filter(
          (component): component is IDisplayComponentSimulation =>
            component.type === EParseTxComponentType.Simulation,
        ),
    [decodedTxs],
  );

  const visibleSimulationComponents = useMemo(
    () =>
      simulationComponents.filter((component) => component.assets.length > 0),
    [simulationComponents],
  );

  // TransactionPreview owns every simulation slot on this page. Empty
  // simulations carry no asset information and must not fall back to the old
  // glowing card in TxConfirmDetails.
  const shouldHideSimulationInDetails = simulationComponents.length > 0;

  const securityCheckRequestKey = useMemo(
    () =>
      (reactiveUnsignedTxs ?? [])
        .map(
          (tx, index) =>
            tx.uuid ?? `${tx.accountId ?? ''}:${tx.networkId ?? ''}:${index}`,
        )
        .join('|'),
    [reactiveUnsignedTxs],
  );

  const {
    result: transactionSecurityInfo,
    isPending: isTransactionSecurityPending,
    isApplicable: isTransactionSecurityApplicable,
    isPrimeUser,
    requestKey: transactionSecurityRequestKey,
    retry: retryTransactionSecurityCheck,
  } = useTransactionSecurityCheck({
    requestKey: securityCheckRequestKey,
    origin: sourceInfo?.origin,
    accountId,
    networkId,
    unsignedTxs: reactiveUnsignedTxs,
  });

  const securityCheckModel = useMemo(
    () =>
      buildSecurityCheckModel({
        kind: 'transaction',
        requestKey: transactionSecurityRequestKey,
        origin: sourceInfo?.origin,
        urlSecurityInfo,
        decodedTxs,
        isParserPending: !decodedTxsInit || isBuildingDecodedTxs,
        transactionSecurityInfo,
        isTransactionSecurityPending,
        isTransactionSecurityApplicable,
        isPrimeUser,
        intl,
      }),
    [
      decodedTxs,
      decodedTxsInit,
      intl,
      isBuildingDecodedTxs,
      isPrimeUser,
      isTransactionSecurityApplicable,
      isTransactionSecurityPending,
      sourceInfo?.origin,
      transactionSecurityRequestKey,
      transactionSecurityInfo,
      urlSecurityInfo,
    ],
  );

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
      updateSendFeeStatus({
        status: ESendFeeStatus.Idle,
        errMessage: '',
        discountPercent: 0,
      });
      appEventBus.off(
        EAppEventBusNames.RefreshNativeTokenInfo,
        refreshNativeTokenInfo,
      );
    };
  }, [fetchNativeTokenInfo, updateSendFeeStatus]);

  useEffect(() => {
    dismissKeyboard();
    updateUnsignedTxs(unsignedTxs);
  }, [unsignedTxs, updateUnsignedTxs]);

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

  // Pre-warm the device while the user reviews, so Sign can skip Initialize.
  // Fire-and-forget; the service no-ops for non-hardware wallets.
  useEffect(() => {
    if (!accountId) {
      return;
    }
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    void backgroundApiProxy.serviceHardware.preInitializeDeviceForSign({
      walletId,
    });
  }, [accountId]);

  const renderTxConfirmContent = useCallback(() => {
    if (
      (isBuildingDecodedTxs || !decodedTxs || decodedTxs.length === 0) &&
      !decodedTxsInit
    ) {
      return <SignatureConfirmLoading />;
    }

    return (
      <YStack gap="$5">
        <TxConfirmAlert
          networkId={networkId}
          accountId={accountId}
          transferPayload={transferPayload}
          gasAccountScenario={gasAccountScenario}
        />
        {sourceInfo?.origin ? (
          <DAppSiteMark
            origin={sourceInfo.origin}
            urlSecurityInfo={urlSecurityInfo}
            hideRiskStyle={shouldHideDAppSiteRiskStyle(urlSecurityInfo)}
          />
        ) : null}
        <SecurityCheckCard
          model={securityCheckModel}
          onRetry={retryTransactionSecurityCheck}
        />
        {visibleSimulationComponents.length ? (
          <TransactionPreview
            key={securityCheckRequestKey}
            simulationComponents={visibleSimulationComponents}
          />
        ) : null}
        <TxConfirmDetails
          accountId={accountId}
          networkId={networkId}
          hideSimulation={shouldHideSimulationInDetails}
        />
        <TxConfirmExtraInfo
          accountId={accountId}
          networkId={networkId}
          unsignedTxs={unsignedTxs}
        />
        <DeFiActionInfo unsignedTxs={unsignedTxs} />
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
    gasAccountScenario,
    sourceInfo?.origin,
    urlSecurityInfo,
    visibleSimulationComponents,
    securityCheckRequestKey,
    securityCheckModel,
    retryTransactionSecurityCheck,
    shouldHideSimulationInDetails,
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

  const shouldRenderHeaderRight = useMemo(
    () =>
      Boolean(
        getTxConfirmMevProtectionProvider({
          decodedTxs,
          unsignedTxs,
          effectiveFeePayer,
          txFeeInfoInit,
        }),
      ),
    [decodedTxs, unsignedTxs, effectiveFeePayer, txFeeInfoInit],
  );

  const renderHeaderRight = useCallback(() => {
    if (!shouldRenderHeaderRight) {
      return null;
    }

    return (
      <TxConfirmHeaderRight
        decodedTxs={decodedTxs}
        unsignedTxs={unsignedTxs}
        effectiveFeePayer={effectiveFeePayer}
        txFeeInfoInit={txFeeInfoInit}
      />
    );
  }, [
    decodedTxs,
    unsignedTxs,
    effectiveFeePayer,
    txFeeInfoInit,
    shouldRenderHeaderRight,
  ]);

  return (
    <Page
      scrollEnabled
      onClose={handleOnClose}
      safeAreaEnabled
      testID={SignatureConfirmTestIDs.TxConfirmPage}
    >
      <Page.Header
        title={txConfirmTitle}
        headerRight={shouldRenderHeaderRight ? renderHeaderRight : undefined}
        unstable_headerRightItems={undefined}
      />
      <Page.Body testID={SignatureConfirmTestIDs.TxConfirmBody} px="$5">
        {renderTxQueueController()}
        {renderTxConfirmContent()}
      </Page.Body>
      <TxConfirmActions
        {...route.params}
        accountId={accountId}
        networkId={networkId}
        securityCheckConfirmation={securityCheckModel.confirmation}
        securityCheckAcknowledgementKey={securityCheckModel.acknowledgementKey}
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
