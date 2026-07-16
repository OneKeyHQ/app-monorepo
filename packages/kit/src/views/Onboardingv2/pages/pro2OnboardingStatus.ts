import { DevOnboardingStage } from '@onekeyfe/hd-transport';

import type { DevOnboardingStatus } from '@onekeyfe/hd-transport';

export type IPro2OnboardingPhase =
  | 'checking'
  | 'personalization'
  | 'setup'
  | 'backup'
  | 'ready';

export enum EPro2OnboardingStep {
  Checking = 0,
  Personalization = 1,
  Pin = 2,
  Setup = 3,
  Done = 4,
}

export type IPro2SetupSubStatus =
  | { kind: 'choice' }
  | { kind: 'create'; card: 'recoveryPhrase' | 'seedCard' }
  | { kind: 'restore'; method?: 'recoveryPhrase' | 'seedCard' };

export type IPro2OnboardingViewState = {
  phase: IPro2OnboardingPhase;
  step: EPro2OnboardingStep;
  setup?: IPro2SetupSubStatus;
  stage: DevOnboardingStage;
  statusCode?: number;
  detailCode?: number;
};

function normalizeOnboardingStage(stage: unknown): DevOnboardingStage {
  if (typeof stage === 'number') {
    return stage as DevOnboardingStage;
  }
  if (typeof stage === 'string') {
    const enumValue =
      DevOnboardingStage[stage as keyof typeof DevOnboardingStage];
    if (typeof enumValue === 'number') {
      return enumValue;
    }
  }
  return DevOnboardingStage.DEV_ONBOARDING_STAGE_UNKNOWN;
}

function getStepperState(stage: DevOnboardingStage): {
  step: EPro2OnboardingStep;
  setup?: IPro2SetupSubStatus;
} {
  switch (stage) {
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION:
      return { step: EPro2OnboardingStep.Personalization };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SETUP_METHOD:
      return { step: EPro2OnboardingStep.Pin };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_NEW_DEVICE:
      return {
        step: EPro2OnboardingStep.Setup,
        setup: { kind: 'create', card: 'recoveryPhrase' },
      };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_RESTORE_METHOD:
      return {
        step: EPro2OnboardingStep.Setup,
        setup: { kind: 'restore' },
      };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_MNEMONIC:
      return {
        step: EPro2OnboardingStep.Setup,
        setup: { kind: 'restore', method: 'recoveryPhrase' },
      };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_SEEDCARD:
      return {
        step: EPro2OnboardingStep.Setup,
        setup: { kind: 'restore', method: 'seedCard' },
      };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_WALLET_READY:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP_PROMPT:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SEEDCARD_BACKUP_METHOD:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP:
      return {
        step: EPro2OnboardingStep.Setup,
        setup: { kind: 'create', card: 'seedCard' },
      };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_DONE:
      return { step: EPro2OnboardingStep.Done };
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_UNKNOWN:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SAFETY_CHECK:
    default:
      return { step: EPro2OnboardingStep.Checking };
  }
}

function getPhase(stage: DevOnboardingStage): IPro2OnboardingPhase {
  switch (stage) {
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION:
      return 'personalization';
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SETUP_METHOD:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_NEW_DEVICE:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_RESTORE_METHOD:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_MNEMONIC:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_SEEDCARD:
      return 'setup';
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_WALLET_READY:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP_PROMPT:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SEEDCARD_BACKUP_METHOD:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP:
      return 'backup';
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_DONE:
      return 'ready';
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_UNKNOWN:
    case DevOnboardingStage.DEV_ONBOARDING_STAGE_SAFETY_CHECK:
    default:
      return 'checking';
  }
}

export function mapPro2OnboardingStatus(
  status: DevOnboardingStatus,
): IPro2OnboardingViewState {
  const stage = normalizeOnboardingStage(status.stage);
  return {
    phase: getPhase(stage),
    ...getStepperState(stage),
    stage,
    ...(status.status_code === undefined
      ? {}
      : { statusCode: status.status_code }),
    ...(status.detail_code === undefined
      ? {}
      : { detailCode: status.detail_code }),
  };
}
