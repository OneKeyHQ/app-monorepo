import { memo } from 'react';
import type { ReactNode } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Image,
  Portal,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import { MOCK_PRO2_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/devicePro2Mock';
import type { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { SeedCardIllustration } from '../components/SeedCardIllustration';
import { SetupCardBody } from '../components/SetupCard';
import { SetupCardBackground } from '../components/SetupCardBackground';
import { SetupStepItem } from '../components/SetupStepItem';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { EDeviceType } from '@onekeyfe/hd-shared';

// MOCK(pro2): the whole device-driven onboarding for OneKey Pro 2 is mocked —
// the device can't connect to the App yet, so there is no real
// `deviceGetOnboardingStatus` to poll. This single file holds the mock status
// contract, the capability predicate, the status→view mapper, the (mock-copy)
// step content, and a dev-only panel to drive the status by hand.
//
// Convergence (Q5 = build the real seam): the mapper + the SetupStepItem
// rendering are the REAL seam and stay; what gets swapped is —
//   - `IMockOnboardingStatus`/`EMockOnboardingStep` → the SDK's real
//     `OnboardingStatus` (same field shape: step + setup);
//   - the status SOURCE: this file's local state + dev panel →
//     `deviceGetOnboardingStatus` polling;
//   - `supportsDeviceDrivenOnboarding` → a real firmware/protocol capability
//     check (Pro joins once its firmware migrates to protocol-v2).
// User-facing copy is wired to i18n (`device_setup_*`); only the dev panel below
// and the "SeedCard"/"OneKey SeedCard" product names stay hardcoded. Delete this
// file and rewire DeviceSetup to the real status source.

const pro2Avatar = HwWalletAvatarImages.pro2;

// Synthetic device payload shared by the demo entry points (fake list row, dev
// entry button). Looks like a found device but never touches hardware; the
// `name` feeds CheckAndUpdate's device-label copy.
const MOCK_PRO2_DEVICE_DATA = {
  title: 'OneKey Pro 2',
  src: pro2Avatar,
  device: {
    deviceType: MOCK_PRO2_DEVICE_TYPE,
    name: 'OneKey Pro 2',
  } as unknown as SearchDevice,
} as IConnectYourDeviceItem;

// ---------------------------------------------------------------------------
// Contract (mirrors the agreed, not-yet-shipped device onboarding model)
// ---------------------------------------------------------------------------

export enum EMockOnboardingStep {
  Checking = 0,
  Personalization = 1, // "Personalize your device"
  Pin = 2, // "Create PIN"
  Setup = 3, // "Set up wallet"
  Done = 4, // SETUP complete → device ready (no FIRMWARE step)
}

export type IMockSetupSubStatus =
  | { kind: 'choice' }
  | { kind: 'create'; card: 'recoveryPhrase' | 'seedCard' }
  | { kind: 'restore'; method?: 'recoveryPhrase' | 'seedCard' };

export interface IMockOnboardingStatus {
  step: EMockOnboardingStep;
  setup?: IMockSetupSubStatus; // only meaningful while step === Setup
}

export const MOCK_INITIAL_STATUS: IMockOnboardingStatus = {
  step: EMockOnboardingStep.Checking,
};

// Capability predicate. MOCK: only the mock Pro 2 qualifies today. Convergence:
// replace the body with a real firmware/protocol check (responds to
// GetOnboardingStatus); Pro then joins automatically without touching callers.
export function supportsDeviceDrivenOnboarding(
  device: { deviceType?: IDeviceType } | undefined,
): boolean {
  return device?.deviceType === MOCK_PRO2_DEVICE_TYPE;
}

// ---------------------------------------------------------------------------
// Pure mapper: status → macro phase
// ---------------------------------------------------------------------------

export type IDeviceSetupPhase = 'checking' | 'needsSetup' | 'ready';

export function mockStatusToPhase(
  status: IMockOnboardingStatus,
): IDeviceSetupPhase {
  if (status.step === EMockOnboardingStep.Checking) {
    return 'checking';
  }
  if (status.step === EMockOnboardingStep.Done) {
    return 'ready';
  }
  return 'needsSetup';
}

// ---------------------------------------------------------------------------
// Step content (mock copy)
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
  setup: IMockSetupSubStatus | undefined,
): IStepContent {
  // The same generic "do it on the device" prompt, reused by several screens.
  const followSteps = intl.formatMessage({
    id: ETranslations.device_setup_follow_steps_instruction,
  });
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
            {intl.formatMessage({
              id: ETranslations.device_setup_create_phrase_desc,
            })}
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
            {intl.formatMessage({
              id: ETranslations.device_setup_create_seedcard_desc,
            })}
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
            {intl.formatMessage({
              id: ETranslations.device_setup_create_seedcard_link,
            })}
          </Anchor>
        </MediaCardBody>
      ),
    };
  }
  // restore branch
  if (setup?.kind === 'restore' && setup.method === 'recoveryPhrase') {
    return {
      instruction: intl.formatMessage({
        id: ETranslations.device_setup_restore_phrase_instruction,
      }),
      body: (
        <SetupCardBody>
          <OptionRow
            title={intl.formatMessage({
              id: ETranslations.device_setup_restore_phrase_title,
            })}
            desc={intl.formatMessage({
              id: ETranslations.device_setup_restore_phrase_desc,
            })}
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
            title={intl.formatMessage({
              id: ETranslations.device_setup_restore_seedcard_title,
            })}
            desc={intl.formatMessage({
              id: ETranslations.device_setup_restore_seedcard_desc,
            })}
          />
        </SetupCardBody>
      ),
    };
  }
  if (setup?.kind === 'restore') {
    return {
      instruction: intl.formatMessage({
        id: ETranslations.device_setup_restore_instruction,
      }),
      body: (
        <SetupCardBody gap="$4">
          <SizableText color="$textSubdued" size="$bodyMdMedium">
            {intl.formatMessage({
              id: ETranslations.device_setup_restore_desc,
            })}
          </SizableText>
          <OptionRow
            title={intl.formatMessage({
              id: ETranslations.global_recovery_phrase,
            })}
            desc={intl.formatMessage({
              id: ETranslations.device_setup_restore_option_phrase_desc,
            })}
          />
          {/* "SeedCard" is a product name — untranslatable, so hardcoded. */}
          <OptionRow
            title="SeedCard"
            desc={intl.formatMessage({
              id: ETranslations.device_setup_restore_option_seedcard_desc,
            })}
          />
        </SetupCardBody>
      ),
    };
  }
  // choice (default)
  return {
    instruction: intl.formatMessage({
      id: ETranslations.device_setup_wallet_instruction,
    }),
    body: (
      <SetupCardBody gap="$4">
        <SizableText color="$textSubdued" size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.device_setup_wallet_desc })}
        </SizableText>
        <OptionRow
          title={intl.formatMessage({
            id: ETranslations.onboarding_create_new_wallet,
          })}
          desc={intl.formatMessage({
            id: ETranslations.device_setup_wallet_option_create_desc,
          })}
        />
        <OptionRow
          title={intl.formatMessage({
            id: ETranslations.device_setup_wallet_option_restore,
          })}
          desc={intl.formatMessage({
            id: ETranslations.device_setup_wallet_option_restore_desc,
          })}
        />
      </SetupCardBody>
    ),
  };
}

function getStepContent(
  intl: IntlShape,
  step: EMockOnboardingStep,
  status: IMockOnboardingStatus,
): IStepContent {
  if (step === EMockOnboardingStep.Personalization) {
    return {
      instruction: intl.formatMessage({
        id: ETranslations.device_setup_personalize_instruction,
      }),
      body: (
        <TextBody>
          {intl.formatMessage({
            id: ETranslations.device_setup_personalize_desc,
          })}
        </TextBody>
      ),
    };
  }
  if (step === EMockOnboardingStep.Pin) {
    return {
      instruction: intl.formatMessage({
        id: ETranslations.device_setup_pin_instruction,
      }),
      body: (
        <TextBody>
          {intl.formatMessage({ id: ETranslations.device_setup_pin_desc })}
        </TextBody>
      ),
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
  step: EMockOnboardingStep,
  setup: IMockSetupSubStatus | undefined,
): string {
  if (step !== EMockOnboardingStep.Setup) {
    return EMockOnboardingStep[step];
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
    step: EMockOnboardingStep.Personalization,
    titleId: ETranslations.device_setup_personalize_title,
  },
  {
    step: EMockOnboardingStep.Pin,
    titleId: ETranslations.device_setup_pin_title,
  },
  {
    step: EMockOnboardingStep.Setup,
    titleId: ETranslations.device_setup_wallet_title,
  },
];

export function Pro2OnboardingStepper({
  status,
}: {
  status: IMockOnboardingStatus;
}) {
  const intl = useIntl();
  const currentIndex = status.step - EMockOnboardingStep.Personalization;
  return (
    <YStack>
      {STEPPER_STEPS.map((def, i) => {
        const state = stepStateForIndex(i, currentIndex);
        const isLast = i === STEPPER_STEPS.length - 1;
        const content =
          state === 'inProgress'
            ? getStepContent(intl, def.step, status)
            : undefined;
        return (
          <SetupStepItem
            key={def.titleId}
            state={state}
            title={intl.formatMessage({ id: def.titleId })}
            showConnector={!isLast}
            contentKey={
              content ? stepContentKey(def.step, status.setup) : undefined
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

// ---------------------------------------------------------------------------
// Dev-only progression panel (gated by dev settings)
// ---------------------------------------------------------------------------

// DEMO(pro2): timers driving FinalizeWalletSetup's step animation (it just
// listens for these bus events). Pending timers are cleared before each run so
// re-entry (back out, click "Create wallet" again) can't deliver a stale event
// into the freshly-mounted page; events firing with no page mounted are
// discarded by the bus, which is fine.
let pendingFinalizeEventTimers: ReturnType<typeof setTimeout>[] = [];

function scheduleMockFinalizeEvents() {
  pendingFinalizeEventTimers.forEach(clearTimeout);
  pendingFinalizeEventTimers = [
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
        step: EFinalizeWalletSetupSteps.GeneratingAccounts,
      });
    }, 1500),
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
        step: EFinalizeWalletSetupSteps.Ready,
      });
    }, 3000),
  ];
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      testID="pro2-mock-dev-button"
      size="small"
      variant="secondary"
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

// The panel surface (status readout + progression buttons). Memoized because
// Portal.Body — used for the floating web HUD — warns in dev when handed a
// non-memoized child.
const Pro2MockDevPanelSurface = memo(function Pro2MockDevPanelSurface({
  status,
  set,
  floating,
}: {
  status: IMockOnboardingStatus;
  set: (next: IMockOnboardingStatus) => void;
  floating: boolean;
}) {
  const navigation = useAppNavigation();
  const { step, setup } = status;
  return (
    // Force the onboarding dark theme: the floating HUD renders through a root
    // Portal, outside the page's `<Theme name="dark">`, so without this its
    // tokens would resolve against the app's default (light) theme.
    <YStack
      theme="dark"
      p="$3"
      gap="$3"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderStyle={floating ? 'solid' : 'dashed'}
      mt={floating ? 0 : '$8'}
      bg={floating ? '$bg' : undefined}
      style={
        floating
          ? // Web-only fixed HUD. position:fixed, vh, overflowY and boxShadow are
            // web CSS absent from RN's ViewStyle, applied only on web — hence the
            // cast. It renders inside a root Portal (below) so `fixed` anchors to
            // the viewport rather than a transformed page ancestor.
            ({
              position: 'fixed',
              left: 16,
              bottom: 16,
              zIndex: 1000,
              width: 300,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            } as any)
          : undefined
      }
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        DEV · mock onboarding status — step={EMockOnboardingStep[step]}
        {setup ? ` · setup=${JSON.stringify(setup)}` : ''}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        {step === EMockOnboardingStep.Checking ? (
          <DevButton
            label="Begin"
            onPress={() => set({ step: EMockOnboardingStep.Personalization })}
          />
        ) : null}
        {step === EMockOnboardingStep.Personalization ? (
          <DevButton
            label="Next: PIN"
            onPress={() => set({ step: EMockOnboardingStep.Pin })}
          />
        ) : null}
        {step === EMockOnboardingStep.Pin ? (
          <DevButton
            label="Next: Setup"
            onPress={() =>
              set({
                step: EMockOnboardingStep.Setup,
                setup: { kind: 'choice' },
              })
            }
          />
        ) : null}
        {step === EMockOnboardingStep.Setup && setup?.kind === 'choice' ? (
          <>
            <DevButton
              label="Create"
              onPress={() =>
                set({
                  step: EMockOnboardingStep.Setup,
                  setup: { kind: 'create', card: 'recoveryPhrase' },
                })
              }
            />
            <DevButton
              label="Restore"
              onPress={() =>
                set({
                  step: EMockOnboardingStep.Setup,
                  setup: { kind: 'restore' },
                })
              }
            />
          </>
        ) : null}
        {step === EMockOnboardingStep.Setup && setup?.kind === 'create' ? (
          <>
            {setup.card === 'recoveryPhrase' ? (
              <DevButton
                label="Next: SeedCard"
                onPress={() =>
                  set({
                    step: EMockOnboardingStep.Setup,
                    setup: { kind: 'create', card: 'seedCard' },
                  })
                }
              />
            ) : null}
            <DevButton
              label="Done"
              onPress={() => set({ step: EMockOnboardingStep.Done })}
            />
          </>
        ) : null}
        {step === EMockOnboardingStep.Setup &&
        setup?.kind === 'restore' &&
        !setup.method ? (
          <>
            <DevButton
              label="Recovery Phrase"
              onPress={() =>
                set({
                  step: EMockOnboardingStep.Setup,
                  setup: { kind: 'restore', method: 'recoveryPhrase' },
                })
              }
            />
            <DevButton
              label="SeedCard"
              onPress={() =>
                set({
                  step: EMockOnboardingStep.Setup,
                  setup: { kind: 'restore', method: 'seedCard' },
                })
              }
            />
          </>
        ) : null}
        {step === EMockOnboardingStep.Setup &&
        setup?.kind === 'restore' &&
        setup.method === 'recoveryPhrase' ? (
          // Restoring from a Recovery Phrase flows on to creating a SeedCard
          // backup (you don't have one yet). Restoring from a SeedCard is
          // terminal — you already hold the card.
          <DevButton
            label="Next: SeedCard"
            onPress={() =>
              set({
                step: EMockOnboardingStep.Setup,
                setup: { kind: 'create', card: 'seedCard' },
              })
            }
          />
        ) : null}
        {step === EMockOnboardingStep.Setup &&
        setup?.kind === 'restore' &&
        setup.method === 'seedCard' ? (
          <DevButton
            label="Done"
            onPress={() => set({ step: EMockOnboardingStep.Done })}
          />
        ) : null}
        {step === EMockOnboardingStep.Done ? (
          // DEMO(pro2): enter FinalizeWalletSetup with no params — its
          // createWallet() no-ops (no mnemonic / deviceData), so nothing real
          // is created. The page's step animation is driven by emitting the
          // bus events it already listens for (CreatingWallet is its initial
          // step; Ready reveals the "Enter wallet" button).
          <DevButton
            label="Create wallet"
            onPress={() => {
              navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {});
              scheduleMockFinalizeEvents();
            }}
          />
        ) : null}
        {step !== EMockOnboardingStep.Checking ? (
          <DevButton
            label="Reset"
            onPress={() => set({ step: EMockOnboardingStep.Checking })}
          />
        ) : null}
      </XStack>
    </YStack>
  );
});

// Dev-only progression panel, gated by dev settings. On web/desktop it floats as
// a fixed bottom-left HUD, rendered through a root Portal so it escapes the
// page's transformed ancestors — otherwise `position: fixed` anchors to the
// scrolled page box, not the viewport. On native it renders inline in the flow.
export function Pro2MockDevPanel({
  status,
  onChange: set,
}: {
  status: IMockOnboardingStatus;
  onChange: (next: IMockOnboardingStatus) => void;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  // The floating HUD lives in a root portal ABOVE the navigation stack, so it
  // would keep hovering over pages pushed on top (e.g. FinalizeWalletSetup).
  // Hide it whenever the hosting DeviceSetup screen isn't the focused one.
  const isFocused = useIsFocused();
  if (!devSettings.enabled || !isFocused) {
    return null;
  }
  const surface = (
    <Pro2MockDevPanelSurface
      status={status}
      set={set}
      floating={!platformEnv.isNative}
    />
  );
  return platformEnv.isNative ? (
    surface
  ) : (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      {surface}
    </Portal.Body>
  );
}

// DEMO(pro2): a fake "found device" row for the connect-device list. Looks like
// a real discovery, but skips the connection entirely and jumps straight to
// CheckAndUpdate (whose checks are also mocked for Pro 2, see
// CheckAndUpdate.handleVerifyHardware). Shown whenever the Pro 2 selection is
// active — intentionally NOT dev-gated so the demo reads as a real flow.
// Delete with the rest of the demo scaffolding.
export function Pro2MockDeviceListItem({
  deviceTypeItems,
  tabValue,
}: {
  deviceTypeItems: EDeviceType[];
  tabValue: EConnectDeviceChannel;
}) {
  const navigation = useAppNavigation();
  if (!deviceTypeItems.includes(MOCK_PRO2_DEVICE_TYPE)) {
    return null;
  }
  return (
    <ListItem
      drillIn
      userSelect="none"
      onPress={() => {
        navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
          deviceData: MOCK_PRO2_DEVICE_DATA,
          tabValue,
        });
      }}
    >
      <WalletAvatar
        wallet={undefined}
        img={MOCK_PRO2_DEVICE_DATA.device?.deviceType as IDeviceType}
      />
      <ListItem.Text primary="OneKey Pro 2" flex={1} />
    </ListItem>
  );
}

// Dev-only entry: Pro 2 can't connect, so the real flow never reaches
// DeviceSetup. This jumps straight in with a mock Pro 2 device (skipping
// ConnectYourDevice's connection + CheckAndUpdate). Gated by dev settings and
// only for the Pro 2 selection. Drop this (and its one call site in
// ConnectYourDevice) at convergence.
export function Pro2MockEntryButton({
  deviceTypeItems,
  tabValue,
}: {
  deviceTypeItems: EDeviceType[];
  tabValue: EConnectDeviceChannel;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const navigation = useAppNavigation();
  if (
    !devSettings.enabled ||
    !deviceTypeItems.includes(MOCK_PRO2_DEVICE_TYPE)
  ) {
    return null;
  }
  return (
    <YStack px="$5" pt="$4" alignItems="center">
      <DevButton
        label="DEV · Mock: enter device setup"
        onPress={() => {
          navigation.push(EOnboardingPagesV2.DeviceSetup, {
            deviceData: MOCK_PRO2_DEVICE_DATA,
            tabValue,
            isFirmwareVerified: true,
          });
        }}
      />
    </YStack>
  );
}
