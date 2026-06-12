import { type ReactNode, useCallback, useMemo, useState } from 'react';

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
): ETranslations | undefined {
  switch (step.key) {
    case 'builderFee':
      return ETranslations.perp_enable_trading_steps_builder_fee__desc;
    case 'agentRemoval':
      return ETranslations.perp_enable_trading_steps_agent_removal__desc;
    case 'agent':
      return ETranslations.perp_enable_trading_steps_agent__desc;
    case 'abstraction':
      return ETranslations.perp_enable_trading_steps_abstraction__desc;
    default:
      return undefined;
  }
}

function isEnableTradingConfirmationStep(
  step: IPerpsOrderPanelEnableTradingStep,
) {
  return step.requiresSignature;
}

function renderEnableTradingSummaryUnderline(chunks: ReactNode) {
  return (
    <SizableText
      display="inline-flex"
      size="$bodyMd"
      color="$textSubdued"
      textDecorationLine="underline"
    >
      {chunks}
    </SizableText>
  );
}

function EnableTradingStepsContent({
  initialAccountStatus,
  onOpenGuide,
  onConfirm,
}: {
  initialAccountStatus: IPerpsActiveAccountStatusAtom;
  onOpenGuide: () => void;
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
            {signatureSteps.map((step, index) => {
              const descriptionId = getEnableTradingSignatureDescription(step);

              return (
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
                  {descriptionId ? (
                    <SizableText size="$bodyMd" color="$text">
                      {intl.formatMessage({
                        id: descriptionId,
                      })}
                    </SizableText>
                  ) : null}
                </XStack>
              );
            })}
          </YStack>
        ) : null}
      </YStack>

      <YStack gap="$3">
        <XStack
          gap="$1"
          alignItems="center"
          onPress={onOpenGuide}
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

function EnableTradingStepsHeader({
  initialAccountStatus,
}: {
  initialAccountStatus: IPerpsActiveAccountStatusAtom;
}) {
  const intl = useIntl();
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
  const signatureCount = steps.filter((step) => step.requiresSignature).length;

  return (
    <Dialog.Header>
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.perp_trade_button_enable_trading,
        })}
      </Dialog.Title>
      <SizableText size="$bodyMd" color="$textSubdued" mt="$1.5">
        {intl.formatMessage(
          {
            id: ETranslations.perp_enable_trading_steps_summary_v2__desc,
          },
          {
            count: signatureCount,
            underline: renderEnableTradingSummaryUnderline,
          },
        )}
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
          <EnableTradingStepsHeader initialAccountStatus={accountStatus} />
          <EnableTradingStepsContent
            initialAccountStatus={accountStatus}
            onOpenGuide={() => {
              void dialogInstance.close();
              setTimeout(() => {
                openGuideUrl(
                  buildHelpUrl(
                    `articles/${CONTEXTUAL_ARTICLE_IDS.enableTrading}`,
                  ),
                );
              }, 150);
            }}
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
                return;
              }
              settle(undefined);
              closeDialog();
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
