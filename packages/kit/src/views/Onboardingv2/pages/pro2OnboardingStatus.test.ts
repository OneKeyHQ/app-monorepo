import { DevOnboardingStage } from '@onekeyfe/hd-transport';

import { mapPro2OnboardingStatus } from './pro2OnboardingStatus';

describe('mapPro2OnboardingStatus', () => {
  it.each([
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_UNKNOWN, 'checking'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_SAFETY_CHECK, 'checking'],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION,
      'personalization',
    ],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SETUP_METHOD, 'setup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_NEW_DEVICE, 'setup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_RESTORE_METHOD, 'setup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_MNEMONIC, 'setup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_SEEDCARD, 'setup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_WALLET_READY, 'backup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP_PROMPT, 'backup'],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SEEDCARD_BACKUP_METHOD,
      'backup',
    ],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP, 'backup'],
    [DevOnboardingStage.DEV_ONBOARDING_STAGE_DONE, 'ready'],
  ] as const)('maps stage %s to %s', (stage, expectedPhase) => {
    expect(mapPro2OnboardingStatus({ stage }).phase).toBe(expectedPhase);
  });

  it('preserves diagnostic codes without treating them as completion', () => {
    expect(
      mapPro2OnboardingStatus({
        stage: DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION,
        status_code: 7,
        detail_code: 9,
      }),
    ).toEqual({
      phase: 'personalization',
      stage: DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION,
      statusCode: 7,
      detailCode: 9,
    });
  });
});
