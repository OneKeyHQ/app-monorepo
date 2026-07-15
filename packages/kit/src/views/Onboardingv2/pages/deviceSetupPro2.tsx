import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { type IntlShape, defineMessages, useIntl } from 'react-intl';

import { Anchor, Image, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { SeedCardIllustration } from '../components/SeedCardIllustration';
import { SetupCardBody } from '../components/SetupCard';
import { SetupCardBackground } from '../components/SetupCardBackground';
import { SetupStepItem } from '../components/SetupStepItem';

import {
  EPro2OnboardingStep,
  mapPro2OnboardingStatus,
} from './pro2OnboardingStatus';

import type { IDeviceType } from '@onekeyfe/hd-core';
import type { DevOnboardingStatus } from '@onekeyfe/hd-transport';

const pro2Avatar = HwWalletAvatarImages[EDeviceType.Pro2];

const pro2Messages = defineMessages({
  createPhraseDesc: {
    id: ETranslations.device_setup_create_phrase_desc,
    defaultMessage:
      'Write down each word in order and keep it offline. Anyone with this phrase can access your assets. OneKey cannot recover it for you.',
  },
  createSeedCardDesc: {
    id: ETranslations.device_setup_create_seedcard_desc,
    defaultMessage:
      'Create a wallet backup on a PIN-protected SeedCard with a built-in Secure Element. Treat the card and PIN as sensitive backup materials.',
  },
  createSeedCardLink: {
    id: ETranslations.device_setup_create_seedcard_link,
    defaultMessage: 'Learn about SeedCard',
  },
  followStepsInstruction: {
    id: ETranslations.device_setup_follow_steps_instruction,
    defaultMessage: 'Follow the steps on your device',
  },
  personalizeDesc: {
    id: ETranslations.device_setup_personalize_desc,
    defaultMessage: 'Choose a language and name your device.',
  },
  personalizeInstruction: {
    id: ETranslations.device_setup_personalize_instruction,
    defaultMessage: 'Continue on your device',
  },
  personalizeTitle: {
    id: ETranslations.device_setup_personalize_title,
    defaultMessage: 'Personalize your device',
  },
  pinDesc: {
    id: ETranslations.device_setup_pin_desc,
    defaultMessage:
      'Your PIN unlocks your device and helps prevent unauthorized access. Keep it private.',
  },
  pinInstruction: {
    id: ETranslations.device_setup_pin_instruction,
    defaultMessage: 'Create a PIN on your device',
  },
  pinTitle: {
    id: ETranslations.device_setup_pin_title,
    defaultMessage: 'Create PIN',
  },
  restoreDesc: {
    id: ETranslations.device_setup_restore_desc,
    defaultMessage: 'Choose how you want to restore your wallet:',
  },
  restoreInstruction: {
    id: ETranslations.device_setup_restore_instruction,
    defaultMessage: 'Choose a restore method',
  },
  restoreOptionPhraseDesc: {
    id: ETranslations.device_setup_restore_option_phrase_desc,
    defaultMessage: 'Use a recovery phrase from an existing wallet.',
  },
  restoreOptionSeedCardDesc: {
    id: ETranslations.device_setup_restore_option_seedcard_desc,
    defaultMessage: 'Use your SeedCard to restore wallet access.',
  },
  restorePhraseDesc: {
    id: ETranslations.device_setup_restore_phrase_desc,
    defaultMessage:
      'Keep it private while restoring. Never enter it in the app or on a website.',
  },
  restorePhraseInstruction: {
    id: ETranslations.device_setup_restore_phrase_instruction,
    defaultMessage: 'Enter the recovery phrase on your device',
  },
  restorePhraseTitle: {
    id: ETranslations.device_setup_restore_phrase_title,
    defaultMessage: 'Restore with recovery phrase',
  },
  restoreSeedCardDesc: {
    id: ETranslations.device_setup_restore_seedcard_desc,
    defaultMessage: 'Keep your SeedCard nearby and follow the device prompts.',
  },
  restoreSeedCardTitle: {
    id: ETranslations.device_setup_restore_seedcard_title,
    defaultMessage: 'Restore with SeedCard',
  },
  walletDesc: {
    id: ETranslations.device_setup_wallet_desc,
    defaultMessage: 'Create a new wallet or restore an existing one:',
  },
  walletInstruction: {
    id: ETranslations.device_setup_wallet_instruction,
    defaultMessage: 'Choose an option on your device',
  },
  walletOptionCreateDesc: {
    id: ETranslations.device_setup_wallet_option_create_desc,
    defaultMessage: 'Generate a new recovery phrase on your device.',
  },
  walletOptionRestore: {
    id: ETranslations.device_setup_wallet_option_restore,
    defaultMessage: 'Restore wallet',
  },
  walletOptionRestoreDesc: {
    id: ETranslations.device_setup_wallet_option_restore_desc,
    defaultMessage: 'Restore from a recovery phrase or SeedCard.',
  },
  walletTitle: {
    id: ETranslations.device_setup_wallet_title,
    defaultMessage: 'Set up wallet',
  },
});

export function supportsDeviceDrivenOnboarding(
  device: { deviceType?: IDeviceType } | undefined,
): boolean {
  return device?.deviceType === EDeviceType.Pro2;
}

// ---------------------------------------------------------------------------
// Pure mapper: status → macro phase
// ---------------------------------------------------------------------------

export type IDeviceSetupPhase = 'checking' | 'needsSetup' | 'ready';

export function onboardingStatusToPhase(
  status: DevOnboardingStatus | undefined,
): IDeviceSetupPhase {
  if (!status) {
    return 'checking';
  }
  const viewState = mapPro2OnboardingStatus(status);
  if (viewState.step === EPro2OnboardingStep.Checking) {
    return 'checking';
  }
  if (viewState.step === EPro2OnboardingStep.Done) {
    return 'ready';
  }
  return 'needsSetup';
}

// ---------------------------------------------------------------------------
// Step content
// ---------------------------------------------------------------------------

function TextBody({ children }: { children: string }) {
  return (
    <SetupCardBody>
      <SizableText color="$textSubdued">{children}</SizableText>
    </SetupCardBody>
  );
}

function OptionRow({ title, desc }: { title: string; desc: string }) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodyMdMedium">{title}</SizableText>
      <SizableText color="$textSubdued">{desc}</SizableText>
    </YStack>
  );
}

// A "Create New Wallet" sub-card body: a 90×90 illustration + title +
// description (the glow/shimmer background is supplied via backgroundSlot).
function MediaCardBody({
  title,
  illustration,
  children,
}: {
  title: string;
  illustration: ReactNode;
  children: ReactNode;
}) {
  return (
    <SetupCardBody alignItems="center" gap="$5">
      {illustration}
      <YStack gap="$2" w="100%">
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        {children}
      </YStack>
    </SetupCardBody>
  );
}

interface IStepContent {
  body: ReactNode;
  instruction: string;
  background?: ReactNode;
}

// Native-glow / web-shimmer geometry for the create sub-cards: the glow bleeds
// down from above the 90×90 illustration and the shimmer field is clipped to sit
// over it. Identical for both create variants — only the color theme differs.
const CREATE_CARD_BG_GEOM = {
  glowSize: 534,
  glowTop: -266,
  shimmerHeight: 220,
};

// MOCK: external "learn more" target for the SeedCard card — placeholder until
// the real product-page URL is wired.
const SEED_CARD_LEARN_URL = 'https://onekey.so';

function getSetupStepContent(
  intl: IntlShape,
  setup: ReturnType<typeof mapPro2OnboardingStatus>['setup'],
): IStepContent {
  // The same generic "do it on the device" prompt, reused by several screens.
  const followSteps = intl.formatMessage(pro2Messages.followStepsInstruction);
  // create branch
  if (setup?.kind === 'create' && setup.card === 'recoveryPhrase') {
    return {
      instruction: followSteps,
      background: (
        <SetupCardBackground variant="brand" {...CREATE_CARD_BG_GEOM} />
      ),
      body: (
        <MediaCardBody
          title={intl.formatMessage({
            id: ETranslations.global_recovery_phrase,
          })}
          illustration={
            <Image
              source={require('@onekeyhq/kit/assets/onboarding/recovery-phrase-setup.png')}
              width={90}
              height={90}
            />
          }
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(pro2Messages.createPhraseDesc)}
          </SizableText>
        </MediaCardBody>
      ),
    };
  }
  if (setup?.kind === 'create' && setup.card === 'seedCard') {
    return {
      instruction: followSteps,
      background: (
        <SetupCardBackground variant="neutral" {...CREATE_CARD_BG_GEOM} />
      ),
      body: (
        // "OneKey SeedCard" is a product name — untranslatable, so hardcoded.
        <MediaCardBody
          title="OneKey SeedCard"
          illustration={<SeedCardIllustration />}
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(pro2Messages.createSeedCardDesc)}
          </SizableText>
          {/* External link — Anchor adds the underline + ↗ and opens the URL
              (web: <a target=_blank>, native: Linking.openURL). */}
          <Anchor
            href={SEED_CARD_LEARN_URL}
            target="_blank"
            rel="noreferrer noopener"
            size="$bodyMd"
            color="$textInfo"
          >
            {intl.formatMessage(pro2Messages.createSeedCardLink)}
          </Anchor>
        </MediaCardBody>
      ),
    };
  }
  // restore branch
  if (setup?.kind === 'restore' && setup.method === 'recoveryPhrase') {
    return {
      instruction: intl.formatMessage(pro2Messages.restorePhraseInstruction),
      body: (
        <SetupCardBody>
          <OptionRow
            title={intl.formatMessage(pro2Messages.restorePhraseTitle)}
            desc={intl.formatMessage(pro2Messages.restorePhraseDesc)}
          />
        </SetupCardBody>
      ),
    };
  }
  if (setup?.kind === 'restore' && setup.method === 'seedCard') {
    return {
      instruction: followSteps,
      body: (
        <SetupCardBody>
          <OptionRow
            title={intl.formatMessage(pro2Messages.restoreSeedCardTitle)}
            desc={intl.formatMessage(pro2Messages.restoreSeedCardDesc)}
          />
        </SetupCardBody>
      ),
    };
  }
  if (setup?.kind === 'restore') {
    return {
      instruction: intl.formatMessage(pro2Messages.restoreInstruction),
      body: (
        <SetupCardBody gap="$4">
          <SizableText color="$textSubdued" size="$bodyMdMedium">
            {intl.formatMessage(pro2Messages.restoreDesc)}
          </SizableText>
          <OptionRow
            title={intl.formatMessage({
              id: ETranslations.global_recovery_phrase,
            })}
            desc={intl.formatMessage(pro2Messages.restoreOptionPhraseDesc)}
          />
          {/* "SeedCard" is a product name — untranslatable, so hardcoded. */}
          <OptionRow
            title="SeedCard"
            desc={intl.formatMessage(pro2Messages.restoreOptionSeedCardDesc)}
          />
        </SetupCardBody>
      ),
    };
  }
  // choice (default)
  return {
    instruction: intl.formatMessage(pro2Messages.walletInstruction),
    body: (
      <SetupCardBody gap="$4">
        <SizableText color="$textSubdued" size="$bodyMdMedium">
          {intl.formatMessage(pro2Messages.walletDesc)}
        </SizableText>
        <OptionRow
          title={intl.formatMessage({
            id: ETranslations.onboarding_create_new_wallet,
          })}
          desc={intl.formatMessage(pro2Messages.walletOptionCreateDesc)}
        />
        <OptionRow
          title={intl.formatMessage(pro2Messages.walletOptionRestore)}
          desc={intl.formatMessage(pro2Messages.walletOptionRestoreDesc)}
        />
      </SetupCardBody>
    ),
  };
}

function getStepContent(
  intl: IntlShape,
  step: EPro2OnboardingStep,
  status: ReturnType<typeof mapPro2OnboardingStatus>,
): IStepContent {
  if (step === EPro2OnboardingStep.Personalization) {
    return {
      instruction: intl.formatMessage(pro2Messages.personalizeInstruction),
      body: (
        <TextBody>{intl.formatMessage(pro2Messages.personalizeDesc)}</TextBody>
      ),
    };
  }
  if (step === EPro2OnboardingStep.Pin) {
    return {
      instruction: intl.formatMessage(pro2Messages.pinInstruction),
      body: <TextBody>{intl.formatMessage(pro2Messages.pinDesc)}</TextBody>,
    };
  }
  // Setup
  return getSetupStepContent(intl, status.setup);
}

// ---------------------------------------------------------------------------
// Stepper view
// ---------------------------------------------------------------------------

function stepStateForIndex(index: number, currentIndex: number) {
  if (index < currentIndex) {
    return 'done' as const;
  }
  if (index === currentIndex) {
    return 'inProgress' as const;
  }
  return 'pending' as const;
}

// Identity of the current inProgress body, so the Setup card cross-fades as its
// sub-status cycles (choice → create → restore → …) instead of hard-swapping.
// Personalization/Pin each have a single body, keyed by the step name.
function stepContentKey(
  step: EPro2OnboardingStep,
  setup: ReturnType<typeof mapPro2OnboardingStatus>['setup'],
): string {
  if (step !== EPro2OnboardingStep.Setup) {
    return EPro2OnboardingStep[step];
  }
  if (!setup || setup.kind === 'choice') {
    return 'Setup:choice';
  }
  if (setup.kind === 'create') {
    return `Setup:create:${setup.card}`;
  }
  return setup.method ? `Setup:restore:${setup.method}` : 'Setup:restore';
}

// The three stepper rows, in order. Titles carry no device name, so each is a
// stable translation id — hoisted so the array isn't reallocated on every
// status change.
const STEPPER_STEPS = [
  {
    step: EPro2OnboardingStep.Personalization,
    title: pro2Messages.personalizeTitle,
  },
  {
    step: EPro2OnboardingStep.Pin,
    title: pro2Messages.pinTitle,
  },
  {
    step: EPro2OnboardingStep.Setup,
    title: pro2Messages.walletTitle,
  },
];

export function Pro2OnboardingStepper({
  status,
}: {
  status: DevOnboardingStatus;
}) {
  const intl = useIntl();
  const viewState = mapPro2OnboardingStatus(status);
  const currentIndex = viewState.step - EPro2OnboardingStep.Personalization;
  return (
    <YStack>
      {STEPPER_STEPS.map((def, i) => {
        const state = stepStateForIndex(i, currentIndex);
        const isLast = i === STEPPER_STEPS.length - 1;
        const content =
          state === 'inProgress'
            ? getStepContent(intl, def.step, viewState)
            : undefined;
        return (
          <SetupStepItem
            key={def.title.id}
            state={state}
            title={intl.formatMessage(def.title)}
            showConnector={!isLast}
            contentKey={
              content ? stepContentKey(def.step, viewState.setup) : undefined
            }
            instruction={content?.instruction}
            deviceImage={content ? pro2Avatar : undefined}
            backgroundSlot={content?.background}
          >
            {content?.body}
          </SetupStepItem>
        );
      })}
    </YStack>
  );
}
