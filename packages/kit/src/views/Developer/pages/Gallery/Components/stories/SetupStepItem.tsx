import type { ReactNode } from 'react';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  SetupCard,
  SetupCardBody,
} from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupCard';
import { SetupCardBackground } from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupCardBackground';
import { SetupStatusCard } from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupStatusCard';
import { SetupStepItem } from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupStepItem';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import { Layout } from './utils/Layout';

const pro2Avatar = HwWalletAvatarImages.pro2;

// A short paragraph body, the common case for a stepper card.
function TextBody({ children }: { children: string }) {
  return (
    <SetupCardBody>
      <SizableText color="$textSubdued">{children}</SizableText>
    </SetupCardBody>
  );
}

// A "title + description" option row, as used in the Setup-and-backup body.
function OptionRow({ title, desc }: { title: string; desc: string }) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodyMdMedium">{title}</SizableText>
      <SizableText color="$textSubdued">{desc}</SizableText>
    </YStack>
  );
}

// A numbered step block for the legacy fallback card.
function NumberedStep({
  n,
  title,
  bullets,
}: {
  n: number;
  title: string;
  bullets: string[];
}) {
  return (
    <YStack gap="$2">
      <XStack gap="$2">
        <YStack
          w="$5"
          h="$5"
          borderRadius="$1"
          borderCurve="continuous"
          bg="$bgStrong"
          alignItems="center"
          justifyContent="center"
        >
          <SizableText textAlign="center">{n}</SizableText>
        </YStack>
        <SizableText size="$bodyMdMedium" flex={1}>
          {title}
        </SizableText>
      </XStack>
      {bullets.map((b) => (
        <XStack key={b} gap="$2">
          <YStack w="$5" h="$5" alignItems="center" justifyContent="center">
            <YStack w={5} h={5} borderRadius="$full" bg="$iconDisabled" />
          </YStack>
          <SizableText color="$textSubdued" flex={1}>
            {b}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}

// A "Create New Wallet" sub-card body: a 90×90 illustration placeholder + a
// title and description. The background (shimmer/glow) is supplied via the
// SetupStepItem `backgroundSlot`, not here.
function CreateWalletBody({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SetupCardBody alignItems="center" gap="$5">
      <YStack
        w={90}
        h={90}
        bg="$borderSubdued"
        borderWidth={1}
        borderColor="$borderStrong"
        borderStyle="dashed"
        borderCurve="continuous"
      />
      <YStack gap="$2" w="100%">
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        {children}
      </YStack>
    </SetupCardBody>
  );
}

const SetupStepItemGallery = () => (
  <Layout
    componentName="SetupCard / SetupStepItem"
    description="设备 onboarding 的卡片体系。SetupCard 是共享外壳（header 由 title 显隐、footer 由 instruction 显隐、elevated 控外观）。SetupStepItem = 左侧 indicator（state 驱动 icon/标题色/elevated）+ SetupCard。SetupStatusCard = 无状态居中卡（status check / device ready）。文案取自 Figma 真实稿。"
    elements={[
      {
        title: 'Pro 2 stepper（done → inProgress → pending，真实文案）',
        element: (
          <YStack>
            <SetupStepItem
              state="done"
              title="OneKey Pro 2 is genuine"
              showConnector
            />
            <SetupStepItem
              state="inProgress"
              title="PIN set"
              showConnector
              deviceImage={pro2Avatar}
              instruction="Set your PIN on your OneKey Pro 2"
            >
              <TextBody>
                Just like any password or passcode, the PIN lets you unlock your
                OneKey Pro 2 and prevent unwanted access.
              </TextBody>
            </SetupStepItem>
            <SetupStepItem
              state="pending"
              title="Setup and backup"
              showConnector
            />
            <SetupStepItem state="pending" title="Firmware" />
          </YStack>
        ),
      },
      {
        title: 'Step 1 · Complete basic config（genuine）',
        element: (
          <YStack>
            <SetupStepItem
              state="inProgress"
              title="OneKey Pro 2 is genuine"
              showConnector
              deviceImage={pro2Avatar}
              instruction="Tap on your OneKey Pro 2 to start setup"
            >
              <TextBody>
                Your OneKey Pro 2 is safe to use. You&apos;re good to go with
                the setup.
              </TextBody>
            </SetupStepItem>
            <SetupStepItem state="pending" title="PIN set" />
          </YStack>
        ),
      },
      {
        title: 'Step 3 · Setup and backup（body 放选项）',
        element: (
          <YStack>
            <SetupStepItem
              state="inProgress"
              title="Setup and backup"
              showConnector
              deviceImage={pro2Avatar}
              instruction="Tap on your OneKey Pro 2 to start setup"
            >
              <SetupCardBody gap="$4">
                <SizableText color="$textSubdued">
                  Choose the setup option that best suits you:
                </SizableText>
                <OptionRow
                  title="Create New Wallet"
                  desc="This generates a new Recovery Phrase"
                />
                <OptionRow
                  title="Restore Wallet"
                  desc="This lets you restore using your Recovery Phrase or SeedCard"
                />
              </SetupCardBody>
            </SetupStepItem>
            <SetupStepItem state="pending" title="Firmware" />
          </YStack>
        ),
      },
      {
        title:
          'Step 3.1 · Create New Wallet（背景 shimmer/glow，brand / neutral）',
        element: (
          <YStack>
            <SetupStepItem
              state="inProgress"
              title="Setup and backup"
              showConnector
              deviceImage={pro2Avatar}
              instruction="Follow instructions on OneKey Pro 2"
              backgroundSlot={
                <SetupCardBackground
                  variant="brand"
                  glowSize={534}
                  glowTop={-266}
                />
              }
            >
              <CreateWalletBody title="Recovery Phrase">
                <SizableText size="$bodyMd" color="$textSubdued">
                  <SizableText size="$bodyMd" color="$text">
                    Keep it safe and private.
                  </SizableText>{' '}
                  Your recovery phrase controls your assets and is
                  irreplaceable. Anyone with your Phrase can steal all your
                  assets. If you lose it, OneKey cannot retrieve it for you.
                </SizableText>
              </CreateWalletBody>
            </SetupStepItem>
            <SetupStepItem
              state="inProgress"
              title="Setup and backup"
              showConnector
              deviceImage={pro2Avatar}
              instruction="Follow instructions on OneKey Pro 2"
              backgroundSlot={
                <SetupCardBackground
                  variant="neutral"
                  glowSize={534}
                  glowTop={-266}
                />
              }
            >
              <CreateWalletBody title="OneKey SeedCard">
                <SizableText size="$bodyMd" color="$textSubdued">
                  Create a new backup on a PIN-protected card with a built-in
                  Secure Element chip — so you can restore access to your assets
                  in just a few taps.
                </SizableText>
                <SizableText size="$bodyMd" color="$text">
                  Learn more ↗
                </SizableText>
              </CreateWalletBody>
            </SetupStepItem>
            <SetupStepItem state="pending" title="Firmware" />
          </YStack>
        ),
      },
      {
        title: '独立卡 · Device status check / Device is ready（无状态、居中）',
        element: (
          <YStack gap="$4" maxWidth={400}>
            <SetupStatusCard tone="checking" label="Device status check" />
            <SetupStatusCard tone="ready" label="Your device is ready" />
          </YStack>
        ),
      },
      {
        title: '独立卡 · Fallback（老设备：classic / mini / touch / pro）',
        element: (
          <YStack maxWidth={440}>
            <SetupCard elevated title="Set up your device">
              <SetupCardBody gap="$5">
                <SizableText color="$textSubdued">
                  Let&apos;s get your device set up.
                </SizableText>
                <NumberedStep
                  n={1}
                  title="Choose your setup option"
                  bullets={[
                    'Create New Wallet: If this is your first wallet',
                    'Import Wallet: If you have an existing recovery phrase',
                  ]}
                />
                <NumberedStep
                  n={2}
                  title="Setup PIN"
                  bullets={[
                    'Set a PIN of at least 4 on your device',
                    "Remember this PIN — you'll need it to unlock your device",
                  ]}
                />
                <NumberedStep
                  n={3}
                  title="Setup recovery phrase"
                  bullets={[
                    'If you already have one, make sure it matches',
                    'Keep your device charging during the process',
                    'Do not power off or lock the device',
                  ]}
                />
                <Button variant="primary" size="large">
                  Done
                </Button>
              </SetupCardBody>
            </SetupCard>
          </YStack>
        ),
      },
      {
        title: 'SetupCard 外壳（elevated on/off、槽位）',
        element: (
          <YStack gap="$4" maxWidth={440}>
            <SetupCard
              elevated
              title="Elevated + title + footer"
              deviceImage={pro2Avatar}
              instruction="Footer shows because instruction is set"
            >
              <TextBody>Body is the open slot.</TextBody>
            </SetupCard>
            <SetupCard title="Flat (not elevated), title only" />
          </YStack>
        ),
      },
    ]}
  />
);

export default SetupStepItemGallery;
