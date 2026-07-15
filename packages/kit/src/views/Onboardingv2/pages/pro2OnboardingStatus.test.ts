import { DevOnboardingStage } from '@onekeyfe/hd-transport';

import {
  EPro2OnboardingStep,
  mapPro2OnboardingStatus,
} from './pro2OnboardingStatus';

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
      step: EPro2OnboardingStep.Personalization,
      stage: DevOnboardingStage.DEV_ONBOARDING_STAGE_PERSONALIZATION,
      statusCode: 7,
      detailCode: 9,
    });
  });

  it.each([
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_SETUP_METHOD,
      EPro2OnboardingStep.Pin,
      undefined,
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_NEW_DEVICE,
      EPro2OnboardingStep.Setup,
      { kind: 'create', card: 'recoveryPhrase' },
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_SELECT_RESTORE_METHOD,
      EPro2OnboardingStep.Setup,
      { kind: 'restore' },
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_MNEMONIC,
      EPro2OnboardingStep.Setup,
      { kind: 'restore', method: 'recoveryPhrase' },
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_RESTORE_SEEDCARD,
      EPro2OnboardingStep.Setup,
      { kind: 'restore', method: 'seedCard' },
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_SEEDCARD_BACKUP,
      EPro2OnboardingStep.Setup,
      { kind: 'create', card: 'seedCard' },
    ],
    [
      DevOnboardingStage.DEV_ONBOARDING_STAGE_DONE,
      EPro2OnboardingStep.Done,
      undefined,
    ],
  ] as const)('maps stage %s to the stepper model', (stage, step, setup) => {
    expect(mapPro2OnboardingStatus({ stage })).toMatchObject({
      step,
      ...(setup ? { setup } : {}),
    });
  });
});
