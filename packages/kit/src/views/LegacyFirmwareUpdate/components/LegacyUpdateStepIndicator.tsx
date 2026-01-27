import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ELegacyFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IStepConfig {
  key: string;
  labelId: ETranslations;
  steps: ELegacyFirmwareUpdateSteps[];
}

const STEP_CONFIG: IStepConfig[] = [
  {
    key: 'prepare',
    labelId: ETranslations.global_preparing,
    steps: [
      ELegacyFirmwareUpdateSteps.idle,
      ELegacyFirmwareUpdateSteps.preparing,
      ELegacyFirmwareUpdateSteps.waitingBootloaderMode,
      ELegacyFirmwareUpdateSteps.checkingBootloader,
    ],
  },
  {
    key: 'download',
    labelId: ETranslations.update_downloading,
    steps: [
      ELegacyFirmwareUpdateSteps.updatingBootloader,
      ELegacyFirmwareUpdateSteps.downloadingFirmware,
    ],
  },
  {
    key: 'install',
    labelId: ETranslations.global_installing_firmware,
    steps: [
      ELegacyFirmwareUpdateSteps.installingFirmware,
      ELegacyFirmwareUpdateSteps.requestDeviceReselect,
    ],
  },
  {
    key: 'done',
    labelId: ETranslations.update_update_completed,
    steps: [ELegacyFirmwareUpdateSteps.done],
  },
];

function StepDot({
  isActive,
  isCompleted,
}: {
  isActive: boolean;
  isCompleted: boolean;
}) {
  const bgColor = isCompleted
    ? '$bgSuccessStrong'
    : isActive
    ? '$bgPrimary'
    : '$bgDisabled';

  return (
    <Stack
      width="$2"
      height="$2"
      borderRadius="$full"
      backgroundColor={bgColor}
      animation="quick"
      scale={isActive ? 1.25 : 1}
      opacity={isCompleted || isActive ? 1 : 0.6}
    />
  );
}

function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <Stack
      flex={1}
      height={2}
      backgroundColor="$bgDisabled"
      mx="$1"
      overflow="hidden"
      borderRadius="$full"
    >
      <Stack
        height="100%"
        width={isCompleted ? '100%' : '0%'}
        backgroundColor="$bgSuccessStrong"
        animation="medium"
      />
    </Stack>
  );
}

export function LegacyUpdateStepIndicator({
  currentStep,
}: {
  currentStep: ELegacyFirmwareUpdateSteps;
}) {
  const intl = useIntl();

  const { currentStepIndex, isError } = useMemo(() => {
    if (currentStep === ELegacyFirmwareUpdateSteps.error) {
      return { currentStepIndex: -1, isError: true };
    }

    for (let i = 0; i < STEP_CONFIG.length; i += 1) {
      if (STEP_CONFIG[i].steps.includes(currentStep)) {
        return { currentStepIndex: i, isError: false };
      }
    }
    return { currentStepIndex: 0, isError: false };
  }, [currentStep]);

  if (isError) {
    return null;
  }

  return (
    <YStack space="$2" mb="$4">
      <XStack alignItems="center" justifyContent="space-between">
        {STEP_CONFIG.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const isLast = index === STEP_CONFIG.length - 1;

          return (
            <XStack key={step.key} flex={1} alignItems="center">
              <StepDot isActive={isActive} isCompleted={isCompleted} />
              {!isLast && <StepConnector isCompleted={isCompleted} />}
            </XStack>
          );
        })}
      </XStack>
      <XStack justifyContent="space-between">
        {STEP_CONFIG.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isActive = index === currentStepIndex;

          return (
            <SizableText
              key={step.key}
              size="$bodySm"
              color={isCompleted || isActive ? '$textSubdued' : '$textDisabled'}
              flex={1}
              textAlign={
                index === 0
                  ? 'left'
                  : index === STEP_CONFIG.length - 1
                  ? 'right'
                  : 'center'
              }
            >
              {intl.formatMessage({ id: step.labelId })}
            </SizableText>
          );
        })}
      </XStack>
    </YStack>
  );
}
