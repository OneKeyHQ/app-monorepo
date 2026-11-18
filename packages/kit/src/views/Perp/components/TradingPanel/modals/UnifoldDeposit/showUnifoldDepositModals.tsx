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
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { TPerpDepositEntrySource } from '@onekeyhq/shared/src/logger/scopes/perp/type';

import { DepositMethodIllustration } from './DepositMethodIllustration';
import { getUnifoldDesktopDialogBodyMaxHeight } from './unifoldDialogLayout';
import { UnifoldTrackerContent } from './UnifoldTrackerContent';
import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { IntlShape } from 'react-intl';

const DESKTOP_DIALOG_MAX_HEIGHT = 'calc(100vh - 64px)';
const DEPOSIT_MENU_DIALOG_WIDTH = 440;
const DESKTOP_DIALOG_WIDTH = 440;
const DESKTOP_DIALOG_MAX_WIDTH = 'calc(100vw - 32px)';
// The dialog panel clamps its own height but never scrolls, so the body has to
// be told how much room is left: 64px panel inset + 70px dialog header + 20px
// content padding.
function useDesktopDialogBodyMaxHeight() {
  const { height } = useWindowDimensions();
  return getUnifoldDesktopDialogBodyMaxHeight(height);
}

// Dialog content is built from a plain function, so the window-dependent bound
// has to be resolved inside a component.
function DesktopTransferBody({
  expectedRecipient,
  onOpenTracker,
  analyticsEntrySource,
}: {
  expectedRecipient: string;
  onOpenTracker: () => void;
  analyticsEntrySource?: TPerpDepositEntrySource;
}) {
  const bodyMaxHeight = useDesktopDialogBodyMaxHeight();
  return (
    <UnifoldTransferContent
      expectedRecipient={expectedRecipient}
      bodyMaxHeight={bodyMaxHeight}
      onOpenTracker={onOpenTracker}
      analyticsEntrySource={analyticsEntrySource}
      trackDefaultSourceSelection
      useDialogHeader
    />
  );
}

function DesktopTrackerBody({
  expectedRecipient,
  onDepositPress,
  onBackPress,
}: {
  expectedRecipient: string;
  onDepositPress: () => void;
  onBackPress?: () => void;
}) {
  const bodyMaxHeight = useDesktopDialogBodyMaxHeight();
  return (
    <UnifoldTrackerContent
      recipientAddress={expectedRecipient}
      listHeight={bodyMaxHeight}
      useDialogHeader
      onDepositPress={onDepositPress}
      onBackPress={onBackPress}
    />
  );
}

export type IUnifoldDepositMenuAction = 'onekey' | 'transfer' | 'tracker';

function MenuActionRow({
  testID,
  icon,
  title,
  subtitle,
  onPress,
}: {
  testID: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const isDarkTheme = useThemeVariant() === 'dark';

  return (
    <Button
      testID={testID}
      variant="tertiary"
      childrenAsText={false}
      alignSelf="stretch"
      height="auto"
      minHeight={80}
      borderRadius="$4"
      bg={isDarkTheme ? '$bgStrong' : '$bgSubdued'}
      mx="$0"
      my="$0"
      px="$5"
      py="$4"
      cursor="pointer"
      hoverStyle={{ bg: isDarkTheme ? '$bgStrongHover' : '$bgHover' }}
      pressStyle={{ bg: isDarkTheme ? '$bgStrongActive' : '$bgActive' }}
      onPress={onPress}
    >
      <XStack flex={1} alignItems="center" gap="$4">
        <Stack
          width="$10"
          height="$10"
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          {icon}
        </Stack>
        <YStack flex={1} minWidth={0} alignItems="flex-start" gap="$1">
          <SizableText
            width="100%"
            size="$headingSm"
            color="$text"
            textAlign="left"
          >
            {title}
          </SizableText>
          <SizableText
            width="100%"
            size="$bodySm"
            color="$textSubdued"
            textAlign="left"
          >
            {subtitle}
          </SizableText>
        </YStack>
        <Icon
          name="ChevronRightSmallOutline"
          color="$iconSubdued"
          size="$5"
          alignSelf="center"
          flexShrink={0}
        />
      </XStack>
    </Button>
  );
}

export function showPerpsUnifoldDepositMenuDialog({
  onAction,
  showTrackerAction = true,
  intl,
  walletName,
}: {
  onAction: (action: IUnifoldDepositMenuAction) => void;
  showTrackerAction?: boolean;
  intl: IntlShape;
  walletName: string;
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
    title: intl.formatMessage({
      id: ETranslations.perp_unifold_deposit_menu__title,
    }),
    showFooter: false,
    floatingPanelProps: {
      width: DEPOSIT_MENU_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
      overflow: 'hidden',
    },
    contentContainerProps: {
      bg: '$bg',
      pt: '$2',
      pb: '$6',
      $md: { pb: '$2' },
    },
    renderContent: (
      <YStack gap="$3" width="100%">
        <MenuActionRow
          testID="perps-deposit-menu-connected-wallet"
          icon={<DepositMethodIllustration variant="wallet" />}
          title={walletName}
          subtitle={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_wallet__desc,
          })}
          onPress={() => {
            void closeThenRun('onekey');
          }}
        />
        <MenuActionRow
          testID="perps-deposit-menu-transfer-crypto"
          icon={<DepositMethodIllustration variant="address" />}
          title={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_address__title,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_address__desc,
          })}
          onPress={() => {
            void closeThenRun('transfer');
          }}
        />
        {showTrackerAction ? (
          <MenuActionRow
            testID="perps-deposit-menu-tracker"
            icon={
              <Icon name="ClockTimeHistoryOutline" color="$icon" size="$6" />
            }
            title={intl.formatMessage({
              id: ETranslations.perp_unifold_crypto_deposits__title,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.perp_unifold_track_progress__desc,
            })}
            onPress={() => {
              void closeThenRun('tracker');
            }}
          />
        ) : null}
      </YStack>
    ),
  });
  return holder.instance;
}

type IDialogInTab = ReturnType<typeof useInTabDialog>;

function showUnifoldTrackerDialogContent({
  dialogInTab,
  expectedRecipient,
  intl,
  onDepositPress,
  onBackPress,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
  intl: IntlShape;
  onDepositPress: () => void;
  onBackPress?: () => void;
}) {
  const holder: { instance?: IDialogInstance } = {};
  const handleDepositPress = async () => {
    await holder.instance?.close();
    onDepositPress();
  };
  const handleBackPress = async () => {
    await holder.instance?.close();
    onBackPress?.();
  };
  holder.instance = dialogInTab.show({
    title: intl.formatMessage({
      id: ETranslations.perp_unifold_crypto_deposits__title,
    }),
    showFooter: false,
    dismissOnOverlayPress: true,
    floatingPanelProps: {
      width: DESKTOP_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
      maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
    },
    renderContent: (
      <DesktopTrackerBody
        expectedRecipient={expectedRecipient}
        onDepositPress={() => {
          void handleDepositPress();
        }}
        onBackPress={
          onBackPress
            ? () => {
                void handleBackPress();
              }
            : undefined
        }
      />
    ),
  });
  return holder.instance;
}

export function showUnifoldTransferDialog({
  dialogInTab,
  expectedRecipient,
  intl,
  analyticsEntrySource,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
  intl: IntlShape;
  analyticsEntrySource?: TPerpDepositEntrySource;
}) {
  // The whole UnifoldDeposit module already sits behind the deposit-entry
  // lazy chunk (preloadPerpsUnifoldDeposit), so static imports are fine here.
  const holder: { instance?: IDialogInstance } = {};
  const handleOpenTracker = async () => {
    await holder.instance?.close();
    showUnifoldTrackerDialogContent({
      dialogInTab,
      expectedRecipient,
      intl,
      onDepositPress: () => {
        showUnifoldTransferDialog({
          dialogInTab,
          expectedRecipient,
          intl,
          analyticsEntrySource,
        });
      },
      onBackPress: () => {
        showUnifoldTransferDialog({
          dialogInTab,
          expectedRecipient,
          intl,
          analyticsEntrySource,
        });
      },
    });
  };
  holder.instance = dialogInTab.show({
    title: intl.formatMessage({
      id: ETranslations.perp_unifold_transfer_crypto__title,
    }),
    showFooter: false,
    dismissOnOverlayPress: true,
    floatingPanelProps: {
      width: DESKTOP_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
      maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
    },
    renderContent: (
      <DesktopTransferBody
        expectedRecipient={expectedRecipient}
        analyticsEntrySource={analyticsEntrySource}
        onOpenTracker={() => {
          void handleOpenTracker();
        }}
      />
    ),
  });
  return holder.instance;
}

export function showUnifoldTrackerDialog({
  dialogInTab,
  expectedRecipient,
  intl,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
  intl: IntlShape;
}) {
  return showUnifoldTrackerDialogContent({
    dialogInTab,
    expectedRecipient,
    intl,
    onDepositPress: () => {
      showUnifoldTransferDialog({
        dialogInTab,
        expectedRecipient,
        intl,
      });
    },
  });
}
