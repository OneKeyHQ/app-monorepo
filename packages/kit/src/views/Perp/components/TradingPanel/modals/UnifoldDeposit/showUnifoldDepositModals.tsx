// cspell: words unifold Unifold
import { useWindowDimensions } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogInstance, useInTabDialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { resolveUnifoldDepositDestination } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { normalizeUnifoldIconUrl } from './unifoldFormat';
import { UnifoldTrackerContent } from './UnifoldTrackerContent';
import { UnifoldTransferContent } from './UnifoldTransferContent';

const DESKTOP_DIALOG_MAX_HEIGHT = 'calc(100vh - 64px)';
const DEPOSIT_MENU_DIALOG_WIDTH = 400;
const DESKTOP_DIALOG_WIDTH = 440;
const DESKTOP_DIALOG_MAX_WIDTH = 'calc(100vw - 32px)';
// The dialog panel clamps its own height but never scrolls, so the body has to
// be told how much room is left: 64px panel inset + 70px dialog header + 20px
// content padding.
const DESKTOP_DIALOG_CHROME_HEIGHT = 154;
const DESKTOP_DIALOG_MIN_BODY_HEIGHT = 320;

function useDesktopDialogBodyMaxHeight() {
  const { height } = useWindowDimensions();
  return Math.max(
    DESKTOP_DIALOG_MIN_BODY_HEIGHT,
    height - DESKTOP_DIALOG_CHROME_HEIGHT,
  );
}

// Dialog content is built from a plain function, so the window-dependent bound
// has to be resolved inside a component.
function DesktopTransferBody({
  expectedRecipient,
}: {
  expectedRecipient: string;
}) {
  const bodyMaxHeight = useDesktopDialogBodyMaxHeight();
  return (
    <UnifoldTransferContent
      expectedRecipient={expectedRecipient}
      bodyMaxHeight={bodyMaxHeight}
      useDialogHeader
    />
  );
}

function DesktopTrackerBody({
  expectedRecipient,
}: {
  expectedRecipient: string;
}) {
  const bodyMaxHeight = useDesktopDialogBodyMaxHeight();
  return (
    <UnifoldTrackerContent
      recipientAddress={expectedRecipient}
      listHeight={bodyMaxHeight}
      useDialogHeader
    />
  );
}

export type IUnifoldDepositMenuAction = 'onekey' | 'transfer' | 'tracker';

function MenuActionRow({
  testID,
  icon,
  title,
  subtitle,
  hint,
  onPress,
}: {
  testID: string;
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  subtitle: string;
  hint?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Button
      testID={testID}
      variant="tertiary"
      childrenAsText={false}
      alignSelf="stretch"
      height="auto"
      minHeight="$14"
      borderRadius="$3"
      mx="$-2"
      px="$2"
      py="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <XStack flex={1} alignSelf="stretch" alignItems="center" gap="$2.5">
        <Stack width="$7" alignItems="flex-start">
          <Icon name={icon} color="$icon" size="$5" />
        </Stack>
        <YStack flex={1} minWidth={0} alignItems="flex-start">
          <SizableText
            width="100%"
            size="$bodyMdMedium"
            color="$text"
            textAlign="left"
            numberOfLines={1}
          >
            {title}
          </SizableText>
          <SizableText
            width="100%"
            size="$bodySm"
            color="$textSubdued"
            textAlign="left"
            numberOfLines={1}
          >
            {subtitle}
          </SizableText>
        </YStack>
        <XStack alignItems="center" gap="$1">
          {hint}
          <Icon
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
            size="$4"
          />
        </XStack>
      </XStack>
    </Button>
  );
}

// Overlapping source-chain icons on the Transfer Crypto row, sourced from the
// wallet-service supported-assets catalog (replaces the old SDK project-config
// logos — no vendor SDK, no pk_ in the client).
function TransferChainHintLogos() {
  const [devSettings] = useDevSettingsPersistAtom();
  const destination = resolveUnifoldDepositDestination(devSettings);
  const { result } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceUnifoldDeposit.getSupportedAssets(destination),
    [destination],
    { watchLoading: false },
  );
  const logos = Array.from(
    new Set(
      (result ?? [])
        .flatMap((asset) => asset.chains ?? [])
        .map((chain) => chain.icon_url)
        .filter(Boolean),
    ),
  ).slice(0, 4);
  if (!logos.length) {
    return null;
  }
  return (
    <XStack alignItems="center">
      {logos.map((uri, index) => (
        <Token
          key={uri}
          size="xxs"
          tokenImageUri={normalizeUnifoldIconUrl(uri)}
          w="$4.5"
          h="$4.5"
          borderWidth="$px"
          borderColor="$bgApp"
          {...(index === 0 ? undefined : { ml: '$-1' })}
        />
      ))}
    </XStack>
  );
}

export function showPerpsUnifoldDepositMenuDialog({
  onAction,
}: {
  onAction: (action: IUnifoldDepositMenuAction) => void;
}) {
  // The menu must be fully closed before the next dialog opens: opening the
  // in-tab transfer/tracker dialog while the menu is still closing leaves the
  // menu stuck on top of it. The holder breaks the cycle between the row
  // handlers and the dialog instance they close.
  const holder: { instance?: IDialogInstance } = {};
  const closeThenRun = async (action: IUnifoldDepositMenuAction) => {
    await holder.instance?.close();
    onAction(action);
  };
  holder.instance = Dialog.show({
    title: 'Deposit',
    showFooter: false,
    floatingPanelProps: {
      width: DEPOSIT_MENU_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
    },
    renderContent: (
      <YStack gap="$1" pb="$4" width="100%">
        <MenuActionRow
          testID="perps-deposit-menu-connected-wallet"
          icon="WalletCryptoOutline"
          title="Connected Wallet"
          subtitle="Min $5 • Instant"
          onPress={() => {
            void closeThenRun('onekey');
          }}
        />
        <MenuActionRow
          testID="perps-deposit-menu-transfer-crypto"
          icon="QrCodeOutline"
          title="Transfer Crypto"
          // Never "No limit": below-minimum deposits have no refund endpoint
          // (contract §4-5), and the minimum is per-chain, so it can only be
          // stated on the next screen once a chain is selected.
          subtitle="Minimum varies by chain • Instant"
          hint={<TransferChainHintLogos />}
          onPress={() => {
            void closeThenRun('transfer');
          }}
        />
        <MenuActionRow
          testID="perps-deposit-menu-tracker"
          icon="ClockTimeHistoryOutline"
          title="Deposit Tracker"
          subtitle="Track your deposit progress"
          onPress={() => {
            void closeThenRun('tracker');
          }}
        />
      </YStack>
    ),
  });
  return holder.instance;
}

type IDialogInTab = ReturnType<typeof useInTabDialog>;

export function showUnifoldTransferDialog({
  dialogInTab,
  expectedRecipient,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
}) {
  // The whole UnifoldDeposit module already sits behind the deposit-entry
  // lazy chunk (preloadPerpsUnifoldDeposit), so static imports are fine here.
  dialogInTab.show({
    title: 'Transfer Crypto',
    showFooter: false,
    dismissOnOverlayPress: true,
    floatingPanelProps: {
      width: DESKTOP_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
      maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
    },
    renderContent: (
      <DesktopTransferBody expectedRecipient={expectedRecipient} />
    ),
  });
}

export function showUnifoldTrackerDialog({
  dialogInTab,
  expectedRecipient,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
}) {
  dialogInTab.show({
    title: 'Deposit Tracker',
    showFooter: false,
    dismissOnOverlayPress: true,
    floatingPanelProps: {
      width: DESKTOP_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
      maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
    },
    renderContent: <DesktopTrackerBody expectedRecipient={expectedRecipient} />,
  });
}
