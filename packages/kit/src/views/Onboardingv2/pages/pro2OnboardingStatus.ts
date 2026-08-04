import {
  OnboardingPhase,
  OnboardingSetupKind,
  OnboardingSetupMethod,
  OnboardingStep,
} from '@onekeyfe/hd-transport';

import type { OnboardingStatus } from '@onekeyfe/hd-transport';

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

export type IPro2OnboardingStatus = OnboardingStatus;

type IPro2NormalizedStep =
  | 'unknown'
  | 'checking'
  | 'personalization'
  | 'pin'
  | 'setup'
  | 'done';

export type IPro2OnboardingViewState = {
  phase: IPro2OnboardingPhase;
  step: EPro2OnboardingStep;
  setup?: IPro2SetupSubStatus;
  devicePhase?: OnboardingPhase;
  pinSet: boolean;
  walletInitialized: boolean;
  ready: boolean;
};

const STEP_BY_VALUE: Record<number | string, IPro2NormalizedStep> = {
  [OnboardingStep.ONBOARDING_STEP_UNKNOWN]: 'unknown',
  [OnboardingStep.ONBOARDING_STEP_CHECKING]: 'checking',
  [OnboardingStep.ONBOARDING_STEP_PERSONALIZATION]: 'personalization',
  [OnboardingStep.ONBOARDING_STEP_PIN]: 'pin',
  [OnboardingStep.ONBOARDING_STEP_SETUP]: 'setup',
  [OnboardingStep.ONBOARDING_STEP_DONE]: 'done',
  ONBOARDING_STEP_UNKNOWN: 'unknown',
  ONBOARDING_STEP_CHECKING: 'checking',
  ONBOARDING_STEP_PERSONALIZATION: 'personalization',
  ONBOARDING_STEP_PIN: 'pin',
  ONBOARDING_STEP_SETUP: 'setup',
  ONBOARDING_STEP_DONE: 'done',
};

function normalizeStep(step: unknown): IPro2NormalizedStep {
  if (typeof step !== 'number' && typeof step !== 'string') {
    return 'unknown';
  }
  return STEP_BY_VALUE[step] ?? 'unknown';
}

function normalizeSetupKind(
  kind: unknown,
): 'choice' | 'create' | 'restore' | undefined {
  switch (kind) {
    case OnboardingSetupKind.ONBOARDING_SETUP_KIND_CHOICE:
    case 'ONBOARDING_SETUP_KIND_CHOICE':
      return 'choice';
    case OnboardingSetupKind.ONBOARDING_SETUP_KIND_CREATE:
    case 'ONBOARDING_SETUP_KIND_CREATE':
      return 'create';
    case OnboardingSetupKind.ONBOARDING_SETUP_KIND_RESTORE:
    case 'ONBOARDING_SETUP_KIND_RESTORE':
      return 'restore';
    default:
      return undefined;
  }
}

function normalizeSetupMethod(
  method: unknown,
): 'recoveryPhrase' | 'seedCard' | undefined {
  switch (method) {
    case OnboardingSetupMethod.ONBOARDING_SETUP_METHOD_RECOVERY_PHRASE:
    case 'ONBOARDING_SETUP_METHOD_RECOVERY_PHRASE':
      return 'recoveryPhrase';
    case OnboardingSetupMethod.ONBOARDING_SETUP_METHOD_SEEDCARD:
    case 'ONBOARDING_SETUP_METHOD_SEEDCARD':
      return 'seedCard';
    default:
      return undefined;
  }
}

function isBackupPhase(phase: unknown): boolean {
  return [
    OnboardingPhase.ONBOARDING_PHASE_WALLET_READY,
    OnboardingPhase.ONBOARDING_PHASE_SEEDCARD_BACKUP_PROMPT,
    OnboardingPhase.ONBOARDING_PHASE_SEEDCARD_BACKUP,
    'ONBOARDING_PHASE_WALLET_READY',
    'ONBOARDING_PHASE_SEEDCARD_BACKUP_PROMPT',
    'ONBOARDING_PHASE_SEEDCARD_BACKUP',
  ].includes(phase as OnboardingPhase | string);
}

function mapSetup(
  status: IPro2OnboardingStatus,
): IPro2SetupSubStatus | undefined {
  const kind = normalizeSetupKind(status.setup?.kind);
  const method = normalizeSetupMethod(status.setup?.method);
  if (kind === 'choice') {
    return { kind: 'choice' };
  }
  if (kind === 'create') {
    return {
      kind: 'create',
      card: method === 'seedCard' ? 'seedCard' : 'recoveryPhrase',
    };
  }
  if (kind === 'restore') {
    return { kind: 'restore', ...(method ? { method } : {}) };
  }
  return undefined;
}

export function mapPro2OnboardingStatus(
  status: IPro2OnboardingStatus,
): IPro2OnboardingViewState {
  const normalizedStep = normalizeStep(status.step);
  const pinSet = status.pin_set === true;
  const walletInitialized = status.wallet_initialized === true;
  const ready = normalizedStep === 'done' && pinSet && walletInitialized;

  if (ready) {
    return {
      phase: 'ready',
      step: EPro2OnboardingStep.Done,
      devicePhase: status.phase,
      pinSet,
      walletInitialized,
      ready: true,
    };
  }

  switch (normalizedStep) {
    case 'personalization':
      return {
        phase: 'personalization',
        step: EPro2OnboardingStep.Personalization,
        devicePhase: status.phase,
        pinSet,
        walletInitialized,
        ready: false,
      };
    case 'pin':
      return {
        phase: 'setup',
        step: EPro2OnboardingStep.Pin,
        devicePhase: status.phase,
        pinSet,
        walletInitialized,
        ready: false,
      };
    case 'setup':
      return {
        phase: isBackupPhase(status.phase) ? 'backup' : 'setup',
        step: EPro2OnboardingStep.Setup,
        setup: mapSetup(status),
        devicePhase: status.phase,
        pinSet,
        walletInitialized,
        ready: false,
      };
    case 'checking':
    case 'unknown':
    case 'done':
    default:
      return {
        phase: 'checking',
        step: EPro2OnboardingStep.Checking,
        devicePhase: status.phase,
        pinSet,
        walletInitialized,
        ready: false,
      };
  }
}
