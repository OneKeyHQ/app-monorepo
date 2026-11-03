// cspell: words unifold Unifold
import { useWindowDimensions } from 'react-native';

import { Dialog, SizableText, XStack, YStack } from '@onekeyhq/components';
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
import type { TPerpDepositEntrySource } from '@onekeyhq/shared/src/logger/scopes/perp/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpTransferMethodRow } from '../PerpTransferMethodRow';

import { getUnifoldDesktopDialogBodyMaxHeight } from './unifoldDialogLayout';
import { normalizeUnifoldIconUrl } from './unifoldFormat';
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
function getSupportedAssetsSwrKey({
  destinationChainType,
  destinationChainId,
  destinationTokenAddress,
}: {
  destinationChainType: string;
  destinationChainId: string;
  destinationTokenAddress: string;
}) {
  return [
    'perpsUnifoldAssets',
    'v1',
    destinationChainType,
    destinationChainId,
    destinationTokenAddress,
  ].join(':');
}

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
  const visibleTokens = tokens.slice(0, 4);
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
        <SizableText
          size="$bodyXs"
          color="$textSubdued"
          fontFamily="$monoRegular"
          ml="$1"
        >
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
    {
      watchLoading: false,
      swrKey: getSupportedAssetsSwrKey(destination),
      swrShouldPersist: (assets) => assets.length > 0,
    },
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
        gap="$2"
        pb={platformEnv.isNative ? '$1' : undefined}
        width="100%"
      >
        <PerpTransferMethodRow
          testID="perps-deposit-menu-connected-wallet"
          icon="WalletCryptoOutline"
          title={intl.formatMessage(
            {
              id: ETranslations.perp_unifold_deposit_menu_wallet__title,
            },
            { wallet: walletName },
          )}
          subtitle={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_wallet__desc,
          })}
          hint={<ConnectedWalletHintLogos />}
          onPress={() => {
            void closeThenRun('onekey');
          }}
        />
        <PerpTransferMethodRow
          testID="perps-deposit-menu-transfer-crypto"
          icon="QrCodeOutline"
          title={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_address__title,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_address__desc,
          })}
          hint={<TransferChainHintLogos />}
          onPress={() => {
            void closeThenRun('transfer');
          }}
        />
        {showTrackerAction ? (
          <PerpTransferMethodRow
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
