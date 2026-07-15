import { DevOnboardingStage } from '@onekeyfe/hd-transport';

import type { DevOnboardingStatus } from '@onekeyfe/hd-transport';

export type IPro2OnboardingPhase =
  | 'checking'
  | 'personalization'
  | 'setup'
  | 'backup'
  | 'ready';

export type IPro2OnboardingViewState = {
  phase: IPro2OnboardingPhase;
  stage: DevOnboardingStage;
  statusCode?: number;
  detailCode?: number;
};

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
  return {
    phase: getPhase(status.stage),
    stage: status.stage,
    ...(status.status_code === undefined
      ? {}
      : { statusCode: status.status_code }),
    ...(status.detail_code === undefined
      ? {}
      : { detailCode: status.detail_code }),
  };
}
