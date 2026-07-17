import {
  DevOnboardingPhase,
  DevOnboardingSetupKind,
  DevOnboardingSetupMethod,
  DevOnboardingStep,
} from '@onekeyfe/hd-transport';

import {
  EPro2OnboardingStep,
  mapPro2OnboardingStatus,
} from './pro2OnboardingStatus';

describe('mapPro2OnboardingStatus', () => {
  it.each([
    [DevOnboardingStep.DEV_ONBOARDING_STEP_UNKNOWN, 'checking'],
    [DevOnboardingStep.DEV_ONBOARDING_STEP_CHECKING, 'checking'],
    [DevOnboardingStep.DEV_ONBOARDING_STEP_PERSONALIZATION, 'personalization'],
    [DevOnboardingStep.DEV_ONBOARDING_STEP_PIN, 'setup'],
    [DevOnboardingStep.DEV_ONBOARDING_STEP_SETUP, 'setup'],
  ] as const)('maps %s to %s', (step, expectedPhase) => {
    expect(mapPro2OnboardingStatus({ step }).phase).toBe(expectedPhase);
  });

  it('maps create recovery phrase setup from explicit setup fields', () => {
    expect(
      mapPro2OnboardingStatus({
        step: DevOnboardingStep.DEV_ONBOARDING_STEP_SETUP,
        phase: DevOnboardingPhase.DEV_ONBOARDING_PHASE_RECOVERY_PHRASE_VIEW,
        setup: {
          kind: DevOnboardingSetupKind.DEV_ONBOARDING_SETUP_KIND_CREATE,
          method:
            DevOnboardingSetupMethod.DEV_ONBOARDING_SETUP_METHOD_RECOVERY_PHRASE,
        },
        pin_set: true,
        wallet_initialized: false,
      }),
    ).toMatchObject({
      step: EPro2OnboardingStep.Setup,
      setup: { kind: 'create', card: 'recoveryPhrase' },
      ready: false,
    });
  });

  it('maps SeedCard restore from numeric protobuf enum values', () => {
    expect(
      mapPro2OnboardingStatus({
        step: 4,
        phase: 10,
        setup: { kind: 3, method: 2 },
        pin_set: true,
        wallet_initialized: false,
      }),
    ).toMatchObject({
      step: EPro2OnboardingStep.Setup,
      setup: { kind: 'restore', method: 'seedCard' },
    });
  });

  it.each([
    DevOnboardingPhase.DEV_ONBOARDING_PHASE_WALLET_READY,
    DevOnboardingPhase.DEV_ONBOARDING_PHASE_SEEDCARD_BACKUP_PROMPT,
    DevOnboardingPhase.DEV_ONBOARDING_PHASE_SEEDCARD_BACKUP,
  ])('maps backup phase %s to the backup presentation', (phase) => {
    expect(
      mapPro2OnboardingStatus({
        step: DevOnboardingStep.DEV_ONBOARDING_STEP_SETUP,
        phase,
        setup: {
          kind: DevOnboardingSetupKind.DEV_ONBOARDING_SETUP_KIND_CREATE,
          method: DevOnboardingSetupMethod.DEV_ONBOARDING_SETUP_METHOD_SEEDCARD,
        },
        pin_set: true,
        wallet_initialized: true,
      }),
    ).toMatchObject({
      phase: 'backup',
      step: EPro2OnboardingStep.Setup,
      setup: { kind: 'create', card: 'seedCard' },
      ready: false,
    });
  });

  it('requires DONE, PIN and initialized wallet before becoming ready', () => {
    expect(
      mapPro2OnboardingStatus({
        step: DevOnboardingStep.DEV_ONBOARDING_STEP_DONE,
        pin_set: true,
        wallet_initialized: true,
      }),
    ).toMatchObject({
      phase: 'ready',
      step: EPro2OnboardingStep.Done,
      ready: true,
    });

    expect(
      mapPro2OnboardingStatus({
        step: DevOnboardingStep.DEV_ONBOARDING_STEP_DONE,
        pin_set: true,
        wallet_initialized: false,
      }),
    ).toMatchObject({
      phase: 'checking',
      step: EPro2OnboardingStep.Checking,
      ready: false,
    });
  });

  it('keeps unknown future enum values in checking state', () => {
    expect(
      mapPro2OnboardingStatus({
        step: 999 as DevOnboardingStep,
      }),
    ).toMatchObject({
      phase: 'checking',
      step: EPro2OnboardingStep.Checking,
      ready: false,
    });
  });
});
