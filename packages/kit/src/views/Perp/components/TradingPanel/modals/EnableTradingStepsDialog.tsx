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
import {
  usePerpsAbstractionModeAtom as usePerpsAbstractionMode,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getPerpsOrderPanelEnableTradingSteps } from '../../../utils/perpsOrderPanelEnableTrading';
import {
  CONTEXTUAL_ARTICLE_IDS,
  buildHelpUrl,
  openGuideUrl,
} from '../../Guide/perpGuideData';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';

import type { IEnableTradingWithDepositFallbackResult } from '../../../hooks/useEnableTradingWithDepositFallback';
import type { IPerpsOrderPanelEnableTradingStep } from '../../../utils/perpsOrderPanelEnableTrading';

type IEnableTradingStepsDialogConfirmContext = {
  closeDialog: () => void;
};

type IEnableTradingStepsDialogConfirm = (
  context: IEnableTradingStepsDialogConfirmContext,
) => Promise<IEnableTradingWithDepositFallbackResult | undefined>;

function getEnableTradingSignatureDescription(
  step: IPerpsOrderPanelEnableTradingStep,
): string {
  switch (step.key) {
    case 'builderFee':
      return 'Confirm OneKey service access';
    case 'agentRemoval':
      return 'Replace previous trading agent';
    case 'agent':
      return 'Authorize OneKey trading agent';
    case 'abstraction':
      return 'Enable unified trading account';
    default:
      return '';
  }
}

function isEnableTradingConfirmationStep(
  step: IPerpsOrderPanelEnableTradingStep,
) {
  return step.requiresSignature;
}

function getHardwareConfirmationCountLabel(count: number) {
  if (count === 1) {
    return 'One';
  }
  if (count === 2) {
    return 'Two';
  }
  if (count === 3) {
    return 'Three';
  }
  return String(count);
}

function EnableTradingStepsContent({
  initialAccountStatus,
  onConfirm,
}: {
  initialAccountStatus: IPerpsActiveAccountStatusAtom;
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  const [isConfirming, setIsConfirming] = useState(false);
  const [liveAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [abstractionMode] = usePerpsAbstractionMode();
  const accountStatus = liveAccountStatus ?? initialAccountStatus;
  const steps = useMemo(
    () =>
      getPerpsOrderPanelEnableTradingSteps(accountStatus, {
        abstractionMode,
      }),
    [abstractionMode, accountStatus],
  );
  const signatureSteps = useMemo(
    () => steps.filter(isEnableTradingConfirmationStep),
    [steps],
  );
  const handleConfirm = useCallback(async () => {
    if (isConfirming) {
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }, [isConfirming, onConfirm]);

  return (
    <YStack gap="$6" p="$1">
      <YStack gap="$4">
        {signatureSteps.length ? (
          <YStack gap="$3">
            {signatureSteps.map((step, index) => (
              <XStack key={step.key} gap="$2.5" alignItems="center">
                <XStack
                  width={18}
                  height={18}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  bg="$bgStrong"
                  flexShrink={0}
                >
                  <SizableText size="$bodyXsMedium" color="$text">
                    {index + 1}
                  </SizableText>
                </XStack>
                <SizableText size="$bodyMd" color="$text">
                  {getEnableTradingSignatureDescription(step)}
                </SizableText>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>

      <YStack gap="$3">
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => {
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
            hoverStyle={{ opacity: 0.8 }}
            pressStyle={{ opacity: 0.7 }}
          >
            {intl.formatMessage({
              id: ETranslations.perp_guide_article_introduction,
            })}
          </SizableText>
        </XStack>

        <Button
          testID="perp-enable-trading-steps-continue"
          width="100%"
          variant="primary"
          size={PERP_DIALOG_BUTTON_SIZE}
          onPress={handleConfirm}
          loading={isConfirming}
          disabled={isConfirming}
        >
          {intl.formatMessage({
            id: ETranslations.global_continue,
          })}
        </Button>
      </YStack>
    </YStack>
  );
}

function EnableTradingStepsHeader() {
  const intl = useIntl();
  const [liveAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [abstractionMode] = usePerpsAbstractionMode();
  const steps = useMemo(
    () =>
      liveAccountStatus
        ? getPerpsOrderPanelEnableTradingSteps(liveAccountStatus, {
            abstractionMode,
          })
        : [],
    [abstractionMode, liveAccountStatus],
  );
  const signatureCount = steps.filter((step) => step.requiresSignature).length;

  return (
    <Dialog.Header>
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.perp_trade_button_enable_trading,
        })}
      </Dialog.Title>
      <SizableText size="$bodyMd" color="$textSubdued" mt="$1.5" mr={-44}>
        Enable trading for instant, gas-free Perps orders. Requires{' '}
        <SizableText
          display="inline-flex"
          size="$bodyMd"
          color="$textSubdued"
          textDecorationLine="underline"
        >
          {getHardwareConfirmationCountLabel(signatureCount)}
        </SizableText>{' '}
        wallet confirmation{signatureCount > 1 ? 's' : ''}.
      </SizableText>
    </Dialog.Header>
  );
}

export function showEnableTradingStepsDialog({
  accountStatus,
  onConfirm,
}: {
  accountStatus: IPerpsActiveAccountStatusAtom;
  onConfirm: IEnableTradingStepsDialogConfirm;
}): Promise<IEnableTradingWithDepositFallbackResult | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (
      value: IEnableTradingWithDepositFallbackResult | undefined,
    ) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const dialogInstance = Dialog.show({
      disableDrag: true,
      dismissOnOverlayPress: false,
      showExitButton: true,
      renderContent: (
        <>
          <EnableTradingStepsHeader />
          <EnableTradingStepsContent
            initialAccountStatus={accountStatus}
            onConfirm={async () => {
              const closeDialog = () => {
                void dialogInstance.close();
              };
              let result: IEnableTradingWithDepositFallbackResult | undefined;
              try {
                result = await onConfirm({ closeDialog });
              } catch {
                result = undefined;
              }
              if (result?.shouldContinue === false) {
                settle(result);
                return;
              }
              if (result) {
                settle(result);
                closeDialog();
              }
            }}
          />
        </>
      ),
      contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
      showFooter: false,
      onClose: () => {
        settle(undefined);
      },
    });
  });
}
