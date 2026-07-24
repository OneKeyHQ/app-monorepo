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
import {
  useDevSettingsPersistAtom,
  usePerpsDepositTokensAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { normalizeUnifoldIconUrl } from './unifoldFormat';
import { UnifoldTrackerContent } from './UnifoldTrackerContent';
import { UnifoldTransferContent } from './UnifoldTransferContent';

import type { IntlShape } from 'react-intl';

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
  onDepositPress,
}: {
  expectedRecipient: string;
  onDepositPress: () => void;
}) {
  const bodyMaxHeight = useDesktopDialogBodyMaxHeight();
  return (
    <UnifoldTrackerContent
      recipientAddress={expectedRecipient}
      listHeight={bodyMaxHeight}
      useDialogHeader
      onDepositPress={onDepositPress}
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

function DepositNetworkHintLogos({
  logoUris,
}: {
  logoUris: (string | undefined)[];
}) {
  const tokens = Array.from(
    new Set(logoUris.filter((uri): uri is string => Boolean(uri))),
  ).map((tokenImageUri) => ({ tokenImageUri }));
  if (!tokens.length) {
    return null;
  }
  const visibleTokens = tokens.slice(0, 6);
  const remainingCount = tokens.length - visibleTokens.length;
  return (
    <XStack alignItems="center">
      {visibleTokens.map((token, index) => (
        <Token
          key={token.tokenImageUri}
          size="xxs"
          tokenImageUri={token.tokenImageUri}
          w="$4.5"
          h="$4.5"
          borderWidth="$px"
          borderColor="$bgApp"
          {...(index === 0 ? undefined : { ml: '$-1' })}
        />
      ))}
      {remainingCount > 0 ? (
        <SizableText size="$bodyXs" color="$textSubdued" ml="$1">
          +{remainingCount}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function isBitcoinIdentity(...values: (string | undefined)[]) {
  const identity = values.filter(Boolean).join(' ').toLowerCase();
  return (
    identity.includes('bitcoin') || identity.split(/[^a-z0-9]+/).includes('btc')
  );
}

function prioritizeBitcoin<T>(
  items: T[],
  matchesBitcoin: (item: T) => boolean,
) {
  return [
    ...items.filter(matchesBitcoin),
    ...items.filter((item) => !matchesBitcoin(item)),
  ];
}

function ConnectedWalletHintLogos() {
  const [{ serverTokens, tokens }] = usePerpsDepositTokensAtom();
  const configuredTokens = serverTokens ?? Object.values(tokens).flat();
  const orderedTokens = prioritizeBitcoin(configuredTokens, (token) =>
    isBitcoinIdentity(token.networkId, token.symbol, token.name),
  );
  return (
    <DepositNetworkHintLogos
      logoUris={orderedTokens.map((token) => token.networkLogoURI)}
    />
  );
}

// Source-chain icons on the Transfer Crypto row, sourced from the wallet
// service supported-assets catalog (no vendor SDK or client-side project key).
function TransferChainHintLogos() {
  const [devSettings] = useDevSettingsPersistAtom();
  const destination = resolveUnifoldDepositDestination(devSettings);
  const { result } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceUnifoldDeposit.getSupportedAssets(destination),
    [destination],
    { watchLoading: false },
  );
  const sourceChains = (result ?? []).flatMap((asset) =>
    (asset.chains ?? []).map((chain) => ({ asset, chain })),
  );
  const orderedChains = prioritizeBitcoin(sourceChains, ({ asset, chain }) =>
    isBitcoinIdentity(
      asset.symbol,
      asset.name,
      chain.chain_type,
      chain.chain_name,
    ),
  );
  return (
    <DepositNetworkHintLogos
      logoUris={orderedChains.map(({ chain }) =>
        normalizeUnifoldIconUrl(chain.icon_url),
      )}
    />
  );
}

export function showPerpsUnifoldDepositMenuDialog({
  onAction,
  showTrackerAction = true,
  intl,
}: {
  onAction: (action: IUnifoldDepositMenuAction) => void;
  showTrackerAction?: boolean;
  intl: IntlShape;
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
      id: ETranslations.perp_trade_deposit,
    }),
    showFooter: false,
    floatingPanelProps: {
      width: DEPOSIT_MENU_DIALOG_WIDTH,
      maxWidth: DESKTOP_DIALOG_MAX_WIDTH,
    },
    contentContainerProps: platformEnv.isNative ? { pb: 0 } : undefined,
    renderContent: (
      <YStack
        gap="$1"
        pb={platformEnv.isNative ? '$1' : undefined}
        width="100%"
      >
        <MenuActionRow
          testID="perps-deposit-menu-connected-wallet"
          icon="WalletCryptoOutline"
          title={intl.formatMessage({
            id: ETranslations.perp_unifold_wallet_deposit__title,
          })}
          subtitle={intl.formatMessage(
            {
              id: ETranslations.perp_unifold_wallet_deposit_summary__desc,
            },
            {
              amount: '$5',
            },
          )}
          hint={<ConnectedWalletHintLogos />}
          onPress={() => {
            void closeThenRun('onekey');
          }}
        />
        <MenuActionRow
          testID="perps-deposit-menu-transfer-crypto"
          icon="QrCodeOutline"
          title={intl.formatMessage({
            id: ETranslations.perp_unifold_transfer_crypto__title,
          })}
          // Never "No limit": below-minimum deposits have no refund endpoint
          // (contract §4-5), and the minimum is per-chain, so it can only be
          // stated on the next screen once a chain is selected.
          subtitle={intl.formatMessage({
            id: ETranslations.perp_unifold_network_minimum_instant__desc,
          })}
          hint={<TransferChainHintLogos />}
          onPress={() => {
            void closeThenRun('transfer');
          }}
        />
        {showTrackerAction ? (
          <MenuActionRow
            testID="perps-deposit-menu-tracker"
            icon="ClockTimeHistoryOutline"
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

export function showUnifoldTransferDialog({
  dialogInTab,
  expectedRecipient,
  intl,
}: {
  dialogInTab: IDialogInTab;
  expectedRecipient: string;
  intl: IntlShape;
}) {
  // The whole UnifoldDeposit module already sits behind the deposit-entry
  // lazy chunk (preloadPerpsUnifoldDeposit), so static imports are fine here.
  dialogInTab.show({
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
      <DesktopTransferBody expectedRecipient={expectedRecipient} />
    ),
  });
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
  const holder: { instance?: IDialogInstance } = {};
  const handleDepositPress = async () => {
    await holder.instance?.close();
    showUnifoldTransferDialog({
      dialogInTab,
      expectedRecipient,
      intl,
    });
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
      />
    ),
  });
  return holder.instance;
}
