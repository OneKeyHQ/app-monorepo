import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import PreSwapStep from '@onekeyhq/kit/src/views/Swap/components/PreSwapStep';
import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  ESwapStepStatus,
  type ISwapStep,
} from '@onekeyhq/shared/types/swap/types';

import {
  CONTEXTUAL_ARTICLE_IDS,
  buildHelpUrl,
  openGuideUrl,
} from '../../Guide/perpGuideData';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';

interface IEnableTradingContentProps {
  onClose?: () => void;
  onComplete?: (status: IPerpsActiveAccountStatusAtom | undefined) => void;
}

type IHardwareSigningStepKey =
  | 'approveBuilderFee'
  | 'removeAgent'
  | 'approveAgent'
  | 'setAbstraction';

function getHardwareStepStatus({
  completed,
  isCurrent,
  isFailed,
  isLoading,
}: {
  completed: boolean;
  isCurrent: boolean;
  isFailed: boolean;
  isLoading: boolean;
}): ESwapStepStatus {
  if (completed) {
    return ESwapStepStatus.SUCCESS;
  }
  if (isFailed && isCurrent) {
    return ESwapStepStatus.FAILED;
  }
  if (isLoading && isCurrent) {
    return ESwapStepStatus.LOADING;
  }
  return ESwapStepStatus.READY;
}

function buildHardwareEnableTradingSteps(
  steps: ISwapStep[],
  {
    failed,
    loading,
  }: {
    failed: boolean;
    loading: boolean;
  },
): ISwapStep[] {
  const currentStepIndex = steps.findIndex(
    (step) => step.status !== ESwapStepStatus.SUCCESS,
  );
  return steps.map((step, index) => {
    const isCurrent = index === currentStepIndex;
    const completed = step.status === ESwapStepStatus.SUCCESS;
    return {
      ...step,
      status: getHardwareStepStatus({
        completed,
        isCurrent,
        isFailed: failed,
        isLoading: loading,
      }),
      canRetry: failed && isCurrent,
    };
  });
}

function EnableTradingContent({
  onClose,
  onComplete,
}: IEnableTradingContentProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [enableTradingFailed, setEnableTradingFailed] = useState(false);
  const [plannedHardwareStepKeys, setPlannedHardwareStepKeys] = useState<
    IHardwareSigningStepKey[] | undefined
  >();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [accountStatus] = usePerpsActiveAccountStatusAtom();
  const activeAccountId = activeAccount.accountId;

  const isHardwareWallet = useMemo(
    () =>
      accountUtils.isHwAccount({
        accountId: activeAccountId ?? '',
      }),
    [activeAccountId],
  );

  const isAgentNotReady = useMemo(
    () => !accountStatus?.details?.agentOk || !accountStatus?.canTrade,
    [accountStatus?.details?.agentOk, accountStatus?.canTrade],
  );

  const {
    result: requiredHardwareSigningSteps,
    isLoading: isHardwareSigningStepsLoading,
  } = usePromiseResult(
    async () => {
      void activeAccountId;
      if (!isHardwareWallet) {
        return [];
      }
      return backgroundApiProxy.serviceHyperliquid.getEnableTradingHardwareSigningSteps();
    },
    [activeAccountId, isHardwareWallet],
    {
      watchLoading: true,
    },
  );

  const hardwareSteps = useMemo<ISwapStep[]>(() => {
    const details = accountStatus?.details;
    const confirmOnDeviceText = '在硬件钱包上确认';
    const visibleStepKeys =
      plannedHardwareStepKeys ?? requiredHardwareSigningSteps ?? [];
    const allSteps: Record<IHardwareSigningStepKey, ISwapStep> = {
      approveBuilderFee: {
        type: 'approveBuilderFee' as ISwapStep['type'],
        status: details?.builderFeeOk
          ? ESwapStepStatus.SUCCESS
          : ESwapStepStatus.READY,
        stepTitle: '签名授权手续费设置',
        stepSubTitle: confirmOnDeviceText,
      },
      removeAgent: {
        type: 'removeAgent' as ISwapStep['type'],
        status: ESwapStepStatus.READY,
        stepTitle: '签名移除旧交易代理',
        stepSubTitle: confirmOnDeviceText,
      },
      approveAgent: {
        type: 'approveAgent' as ISwapStep['type'],
        status:
          details?.agentOk && details?.internalRebateBoundOk
            ? ESwapStepStatus.SUCCESS
            : ESwapStepStatus.READY,
        stepTitle: '签名授权交易代理',
        stepSubTitle: confirmOnDeviceText,
      },
      setAbstraction: {
        type: 'setAbstraction' as ISwapStep['type'],
        status: details?.abstractionOk
          ? ESwapStepStatus.SUCCESS
          : ESwapStepStatus.READY,
        stepTitle: '签名启用统一账户',
        stepSubTitle: confirmOnDeviceText,
      },
    };
    const visibleSteps = visibleStepKeys.map((key) => allSteps[key]);
    return buildHardwareEnableTradingSteps(visibleSteps, {
      failed: enableTradingFailed,
      loading,
    });
  }, [
    accountStatus?.details,
    enableTradingFailed,
    loading,
    plannedHardwareStepKeys,
    requiredHardwareSigningSteps,
  ]);

  const isCheckingHardwareSigningSteps =
    isHardwareWallet &&
    plannedHardwareStepKeys === undefined &&
    requiredHardwareSigningSteps === undefined;

  const handleEnableTrading = useCallback(async () => {
    if (!isAgentNotReady || isCheckingHardwareSigningSteps) return;

    setEnableTradingFailed(false);
    setPlannedHardwareStepKeys((current) => {
      if (current) return current;
      return hardwareSteps.map(
        (step) => step.type as unknown as IHardwareSigningStepKey,
      );
    });
    setLoading(true);
    try {
      const result =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      if (result?.details?.agentOk && result?.canTrade) {
        onComplete?.(result);
        onClose?.();
      } else if (result?.details?.activatedOk === false) {
        onComplete?.(result);
        onClose?.();
      } else {
        setEnableTradingFailed(true);
      }
    } catch (error) {
      setEnableTradingFailed(true);
      console.error('[EnableTradingModal] Failed to enable trading:', error);
    } finally {
      setLoading(false);
    }
  }, [
    hardwareSteps,
    isAgentNotReady,
    isCheckingHardwareSigningSteps,
    onClose,
    onComplete,
  ]);

  const buttonText = useMemo(() => {
    if (loading) {
      return intl.formatMessage({
        id: ETranslations.transfer_transfer_server_status_connecting,
      });
    }
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_enable_trading,
    });
  }, [loading, intl]);

  return (
    <YStack gap="$6" p="$1">
      <YStack gap={isHardwareWallet ? '$5' : '$3'}>
        <SizableText size="$bodyMd" color="$textSubdued">
          {isHardwareWallet
            ? '启用交易会为当前账户建立安全的合约交易通道，之后即可下单且无需每次都连接设备。本次不会发起交易或转出资产；如果需要硬件钱包确认，我们会在下方展示本次签名步骤。'
            : intl.formatMessage({
                id: ETranslations.perp_enable_trading_desc,
              })}
        </SizableText>
        {isHardwareWallet && hardwareSteps.length > 0 ? (
          <YStack py="$1">
            <PreSwapStep steps={hardwareSteps} onRetry={handleEnableTrading} />
          </YStack>
        ) : null}
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => {
            onClose?.();
            setTimeout(() => {
              openGuideUrl(
                buildHelpUrl(
                  `articles/${CONTEXTUAL_ARTICLE_IDS.enableTrading}`,
                ),
              );
            }, 150);
          }}
          cursor="default"
        >
          <Icon name="QuestionmarkOutline" size="$3.5" color="$iconSubdued" />
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            hoverStyle={{ color: '$text' }}
          >
            {intl.formatMessage({
              id: ETranslations.perp_guide_article_introduction,
            })}
          </SizableText>
        </XStack>
      </YStack>

      {isHardwareWallet ? (
        <XStack gap="$3">
          <Button
            testID="perp-enable-trading-cancel-btn"
            flex={1}
            variant="secondary"
            size={PERP_DIALOG_BUTTON_SIZE}
            disabled={loading}
            onPress={onClose}
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button
            testID="perp-btn"
            flex={1}
            variant="primary"
            size={PERP_DIALOG_BUTTON_SIZE}
            disabled={
              loading || !isAgentNotReady || isCheckingHardwareSigningSteps
            }
            loading={loading || isHardwareSigningStepsLoading}
            onPress={handleEnableTrading}
            bg="#18794E"
            hoverStyle={{ bg: '$green8' }}
            pressStyle={{ bg: '$green8' }}
            color="$textOnColor"
          >
            {buttonText}
          </Button>
        </XStack>
      ) : (
        <Button
          testID="perp-btn"
          variant="primary"
          size={PERP_DIALOG_BUTTON_SIZE}
          disabled={loading || !isAgentNotReady}
          loading={loading}
          onPress={handleEnableTrading}
          bg="#18794E"
          hoverStyle={{ bg: '$green8' }}
          pressStyle={{ bg: '$green8' }}
          color="$textOnColor"
        >
          {buttonText}
        </Button>
      )}
    </YStack>
  );
}

export function showEnableTradingDialog(): Promise<
  IPerpsActiveAccountStatusAtom | undefined
> {
  return new Promise((resolve) => {
    let resolved = false;
    const resolveOnce = (status: IPerpsActiveAccountStatusAtom | undefined) => {
      if (resolved) return;
      resolved = true;
      resolve(status);
    };

    const dialogInstance = Dialog.show({
      // Called from jotai action without React context; safe at invocation time
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.perp_trade_button_enable_trading,
      }),
      renderContent: (
        <EnableTradingContent
          onComplete={resolveOnce}
          onClose={() => {
            resolveOnce(undefined);
            void dialogInstance.close();
          }}
        />
      ),
      contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
      showFooter: false,
      onClose: () => {
        resolveOnce(undefined);
        void dialogInstance.close();
      },
    });
  });
}
