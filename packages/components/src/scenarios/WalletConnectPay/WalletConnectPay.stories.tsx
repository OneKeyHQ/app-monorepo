import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { DialogV2 } from '@onekeyhq/components/src/composite/DialogV2';
import { ScrollView } from '@onekeyhq/components/src/layouts/ScrollView';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { Image } from '@onekeyhq/components/src/primitives/Image';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The WalletConnect Pay flow, staged for design review and as the migration
// reference for the production module (packages/kit/src/views/WalletConnectPay).
// DialogV2 is only the presentation shell; everything below is owned by this
// scene, not by the dialog.
//
// Figma: Modules / "Walletconnect pay" (node 21831-35638). Every step shares
// one skeleton — Header, optional Body, optional Footer — laid inside the
// shell's content inset (24pt sides, safe-area bottom; the scene adds no side
// padding of its own):
//   - Header: a 64pt visual over centered text. Vertical padding is 48pt on
//     the transient status steps (fetching / failed / confirming) and 16pt on
//     the payment and success steps.
//   - Body: payment step only — a "Pay with" label over the asset-option
//     card, or the no-asset notice.
//   - Footer: 32pt gap, then one full-width primary pill
//     (Retry / Pay / Close / Done).
//
// Copy is hardcoded on purpose — i18n keys land at integration time.

// ---------------------------------------------------------------------------
// Sample content mirroring the design mock. At integration these come from
// the WC session metadata and IWcPayOptionsResult
// (@onekeyhq/shared/src/walletConnect/payTypes).

const PAYMENT = {
  amountText: '20 USD',
  merchantText: 'to OneKey Test Merchant',
};

const ASSET_ICON_SOURCE = {
  uri: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
};
const NETWORK_ICON_SOURCE = {
  uri: 'https://uni.onekey-asset.com/static/chain/base.png',
};

type IWcPayDemoOption = {
  id: string;
  amountText: string;
  networkName: string;
};

const SAMPLE_OPTIONS: IWcPayDemoOption[] = [
  { id: 'option-1', amountText: '20 USD', networkName: 'Base' },
  { id: 'option-2', amountText: '20 USD', networkName: 'Base' },
  { id: 'option-3', amountText: '20 USD', networkName: 'Base' },
  { id: 'option-4', amountText: '20 USD', networkName: 'Base' },
];

const EMPTY_OPTIONS: IWcPayDemoOption[] = [];

// Rides the scroll content (not the card) so the inset scrolls away with
// the rows instead of leaving a static gap at the clipped edges.
const ASSET_LIST_CONTENT_CONTAINER_STYLE = { p: '$1' } as const;

// ---------------------------------------------------------------------------
// Header — present on every step; only its vertical padding and content vary.

function WcPayHeader({
  visual,
  spacing,
  children,
}: {
  /** The 64pt slot: dapp icon, status badge or spinner. */
  visual: ReactNode;
  /** 'roomy' on the transient status steps (48pt), 'regular' otherwise (16pt). */
  spacing: 'regular' | 'roomy';
  children: ReactNode;
}) {
  return (
    <YStack
      alignItems="center"
      gap="$4"
      py={spacing === 'roomy' ? '$12' : '$4'}
    >
      {visual}
      <YStack alignItems="center" gap="$1">
        {children}
      </YStack>
    </YStack>
  );
}

function WcPayHeaderLine({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$bodyLgMedium" color="$textSubdued" textAlign="center">
      {children}
    </SizableText>
  );
}

function WcPayHeaderAmount({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$heading2xl" color="$text" textAlign="center">
      {children}
    </SizableText>
  );
}

// The 64pt header visuals. Hoisted: they are static, and the components
// package lints against inline JSX in prop position.
const SPINNER_VISUAL = (
  <Stack w="$16" h="$16" alignItems="center" justifyContent="center">
    {/* The 36pt system spinner scaled to the design's 48pt glyph. */}
    <Spinner size="large" scale={4 / 3} />
  </Stack>
);

// The merchant-icon slot: real data renders merchant.iconUrl from the session
// metadata and falls back to this bundled WalletConnect mark (exported from
// the Figma mock, 64pt @3x) when the merchant has none — the sample merchant
// has no icon, so the fallback is what shows here.
const DAPP_ICON_VISUAL = (
  <Image
    source={require('./walletconnect-dapp-icon.png')}
    w="$16"
    h="$16"
    borderRadius={14}
    borderCurve="continuous"
  />
);

const FAILED_BADGE_VISUAL = (
  <Stack
    w="$16"
    h="$16"
    borderRadius="$full"
    borderCurve="continuous"
    bg="$bgCritical"
    alignItems="center"
    justifyContent="center"
  >
    <Icon name="CrossedLargeOutline" size="$8" color="$iconCritical" />
  </Stack>
);

const SUCCESS_BADGE_VISUAL = (
  <Stack
    w="$16"
    h="$16"
    borderRadius="$full"
    borderCurve="continuous"
    bg="$bgSuccessStrong"
    alignItems="center"
    justifyContent="center"
  >
    <Icon name="Checkmark2Solid" size="$8" color="$iconOnColor" />
  </Stack>
);

// ---------------------------------------------------------------------------
// Body — payment step only.

const SELECTED_CHECK = (
  <Icon name="CheckRadioSolid" size="$6" color="$iconActive" />
);

function WcPayAssetOptionRow({
  option,
  selected,
  onSelectOption,
}: {
  option: IWcPayDemoOption;
  selected: boolean;
  onSelectOption: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    onSelectOption(option.id);
  }, [onSelectOption, option.id]);
  return (
    <XStack
      alignItems="center"
      gap="$3"
      minHeight="$12"
      px="$3"
      py="$2"
      borderRadius="$3"
      borderCurve="continuous"
      bg={selected ? '$neutral3' : undefined}
      onPress={handlePress}
    >
      <Stack
        w="$10"
        h="$10"
        borderRadius="$full"
        borderCurve="continuous"
        bg="$bgStrong"
      >
        <Image
          source={ASSET_ICON_SOURCE}
          w="$10"
          h="$10"
          borderRadius="$full"
          borderCurve="continuous"
        />
        <Stack
          position="absolute"
          right={-4}
          bottom={-4}
          p="$0.5"
          bg="$bgApp"
          borderRadius="$full"
          borderCurve="continuous"
        >
          <Image
            source={NETWORK_ICON_SOURCE}
            w="$4"
            h="$4"
            borderRadius="$full"
            borderCurve="continuous"
          />
        </Stack>
      </Stack>
      <YStack flex={1}>
        <SizableText size={selected ? '$headingMd' : '$bodyLg'} color="$text">
          {option.amountText}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {option.networkName}
        </SizableText>
      </YStack>
      {selected ? SELECTED_CHECK : null}
    </XStack>
  );
}

function WcPayAssetList({
  options,
  selectedId,
  onSelectOption,
}: {
  options: IWcPayDemoOption[];
  selectedId: string;
  onSelectOption: (id: string) => void;
}) {
  return (
    <YStack>
      <XStack px="$4" py="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          Pay with
        </SizableText>
      </XStack>
      {/* Fixed 200pt viewport per the design; overflow scrolls inside. */}
      <YStack
        bg="$neutral3"
        borderRadius="$4"
        borderCurve="continuous"
        height={200}
        overflow="hidden"
      >
        <ScrollView contentContainerStyle={ASSET_LIST_CONTENT_CONTAINER_STYLE}>
          {options.map((option) => (
            <WcPayAssetOptionRow
              key={option.id}
              option={option}
              selected={option.id === selectedId}
              onSelectOption={onSelectOption}
            />
          ))}
        </ScrollView>
      </YStack>
    </YStack>
  );
}

function WcPayNoAssetNotice() {
  return (
    // Design token is overlays/white-alpha/1 (0.05), one notch dimmer than
    // the populated card's neutral/3 — $neutral2 is the closest app token.
    <YStack bg="$neutral2" borderRadius="$4" borderCurve="continuous" p="$1">
      <XStack px="$4" py="$2" justifyContent="center">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          No available asset
        </SizableText>
      </XStack>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Footer — 32pt gap, then one full-width primary pill.

function WcPayFooter({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <YStack pt="$8">
      <Button variant="primary" size="large" onPress={onPress}>
        {label}
      </Button>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Steps — each is Header (+ Body) (+ Footer), nothing more.

function WcPayFetchingStep() {
  return (
    <WcPayHeader visual={SPINNER_VISUAL} spacing="roomy">
      <WcPayHeaderLine>Fetching payment info...</WcPayHeaderLine>
    </WcPayHeader>
  );
}

function WcPayFailedStep({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <WcPayHeader visual={FAILED_BADGE_VISUAL} spacing="roomy">
        <WcPayHeaderLine>Fetch payment info failed</WcPayHeaderLine>
      </WcPayHeader>
      <WcPayFooter label="Retry" onPress={onRetry} />
    </>
  );
}

function WcPayOptionsStep({
  options,
  selectedId,
  onSelectOption,
  onConfirmPay,
  onClose,
}: {
  options: IWcPayDemoOption[];
  selectedId: string;
  onSelectOption: (id: string) => void;
  onConfirmPay: () => void;
  onClose: () => void;
}) {
  const hasOptions = options.length > 0;
  return (
    <>
      <WcPayHeader visual={DAPP_ICON_VISUAL} spacing="regular">
        <WcPayHeaderLine>Pay</WcPayHeaderLine>
        <WcPayHeaderAmount>{PAYMENT.amountText}</WcPayHeaderAmount>
        <WcPayHeaderLine>{PAYMENT.merchantText}</WcPayHeaderLine>
      </WcPayHeader>
      {hasOptions ? (
        <WcPayAssetList
          options={options}
          selectedId={selectedId}
          onSelectOption={onSelectOption}
        />
      ) : (
        <WcPayNoAssetNotice />
      )}
      {hasOptions ? (
        <WcPayFooter
          label={`Pay ${PAYMENT.amountText}`}
          onPress={onConfirmPay}
        />
      ) : (
        <WcPayFooter label="Close" onPress={onClose} />
      )}
    </>
  );
}

function WcPayConfirmingStep() {
  return (
    <WcPayHeader visual={SPINNER_VISUAL} spacing="roomy">
      <WcPayHeaderLine>Confirming your payment...</WcPayHeaderLine>
    </WcPayHeader>
  );
}

function WcPaySuccessStep({ onDone }: { onDone: () => void }) {
  return (
    <>
      <WcPayHeader visual={SUCCESS_BADGE_VISUAL} spacing="regular">
        <WcPayHeaderLine>You’ve paid</WcPayHeaderLine>
        <WcPayHeaderAmount>{PAYMENT.amountText}</WcPayHeaderAmount>
        <WcPayHeaderLine>{PAYMENT.merchantText}</WcPayHeaderLine>
      </WcPayHeader>
      <WcPayFooter label="Done" onPress={onDone} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Demo host: one state machine behind every story. The static state stories
// freeze it at a step (autoAdvance off); FullFlow lets the timers run. The
// sheet re-measures on every step change, so the height transitions ride the
// system's own detent animation.

type IWcPayDemoStep =
  | 'fetching'
  | 'failed'
  | 'options'
  | 'confirming'
  | 'success';

function WalletConnectPayDemo({
  initialStep = 'fetching',
  autoAdvance = true,
  noAvailableAssets = false,
}: {
  initialStep?: IWcPayDemoStep;
  /** Simulated service latency: fetching → options, confirming → success. */
  autoAdvance?: boolean;
  noAvailableAssets?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<IWcPayDemoStep>(initialStep);
  const [selectedId, setSelectedId] = useState(SAMPLE_OPTIONS[0].id);
  const options = noAvailableAssets ? EMPTY_OPTIONS : SAMPLE_OPTIONS;

  const handleOpen = useCallback(() => {
    setStep(initialStep);
    setSelectedId(SAMPLE_OPTIONS[0].id);
    setOpen(true);
  }, [initialStep]);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  const handleRetry = useCallback(() => {
    setStep('fetching');
  }, []);
  const handleConfirmPay = useCallback(() => {
    setStep('confirming');
  }, []);

  useEffect(() => {
    if (!open || !autoAdvance) return undefined;
    if (step === 'fetching') {
      const id = setTimeout(() => setStep('options'), 1600);
      return () => clearTimeout(id);
    }
    if (step === 'confirming') {
      const id = setTimeout(() => setStep('success'), 2000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open, autoAdvance, step]);

  let content: ReactNode;
  switch (step) {
    case 'fetching':
      content = <WcPayFetchingStep />;
      break;
    case 'failed':
      content = <WcPayFailedStep onRetry={handleRetry} />;
      break;
    case 'options':
      content = (
        <WcPayOptionsStep
          options={options}
          selectedId={selectedId}
          onSelectOption={setSelectedId}
          onConfirmPay={handleConfirmPay}
          onClose={handleClose}
        />
      );
      break;
    case 'confirming':
      content = <WcPayConfirmingStep />;
      break;
    case 'success':
      content = <WcPaySuccessStep onDone={handleClose} />;
      break;
  }

  return (
    <YStack gap="$4" alignItems="flex-start">
      <Button onPress={handleOpen}>Open payment sheet</Button>
      <DialogV2 open={open} onOpenChange={setOpen}>
        {content}
      </DialogV2>
    </YStack>
  );
}

const meta = {
  title: 'Scenarios/WalletConnectPay',
  component: WalletConnectPayDemo,
  args: {
    initialStep: 'fetching',
    autoAdvance: true,
    noAvailableAssets: false,
  },
  argTypes: {
    initialStep: {
      control: 'select',
      options: ['fetching', 'failed', 'options', 'confirming', 'success'],
    },
    autoAdvance: { control: 'boolean' },
    noAvailableAssets: { control: 'boolean' },
  },
} satisfies Meta<typeof WalletConnectPayDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The whole happy path on timers: fetching → payment options (pick an
 * asset, confirm) → confirming → success → Done. Each height change rides
 * the sheet's own detent animation.
 */
export const FullFlow: Story = {};

/** Figma "Fetching payment info...". */
export const FetchingPaymentInfo: Story = {
  args: { autoAdvance: false },
};

/** Figma "Fetch payment info failed" — Retry returns to the fetching step. */
export const FetchPaymentInfoFailed: Story = {
  args: { initialStep: 'failed', autoAdvance: false },
};

/** Figma "Payment — with available assets" — rows select on tap. */
export const PaymentWithAvailableAssets: Story = {
  args: { initialStep: 'options', autoAdvance: false },
};

/** Figma "Payment — no available assets". */
export const PaymentNoAvailableAssets: Story = {
  args: { initialStep: 'options', autoAdvance: false, noAvailableAssets: true },
};

/** Figma "Confirming your payment...". */
export const ConfirmingYourPayment: Story = {
  args: { initialStep: 'confirming', autoAdvance: false },
};

/** Figma "Pay successfully". */
export const PaySuccessfully: Story = {
  args: { initialStep: 'success', autoAdvance: false },
};
