// cspell: words cashapp onramps unifold Unifold
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  type DepositConfig,
  UnifoldProvider,
  useUnifold,
} from '@unifold/connect-react';
import '@unifold/connect-react/styles-base.css';
import '@unifold/connect-react/styles.css';
import {
  getExchanges,
  getIntegrationExchanges,
  getPreferredIconUrl,
  getProjectConfig,
  getSupportedDestinationTokens,
} from '@unifold/core';
import { createRoot } from 'react-dom/client';

import {
  Dialog,
  Icon,
  Image,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  type IPerpsActiveAccountAtom,
  perpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  UNIFOLD_HYPERCORE_CHAIN_ID,
  UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
  UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
  UNIFOLD_PERPS_PUBLISHABLE_KEY,
} from '../../../consts/unifold';
import { validateHypercoreDestination } from '../../../utils/unifoldDestination';
import { getSafeUnifoldRecipient } from '../../../utils/unifoldRecipient';

import './PerpsUnifoldDepositModal.css';

const unifoldQueryClient = new QueryClient();
const UNIFOLD_QUERY_STALE_TIME = 5 * 60 * 1000;
const PERPS_UNIFOLD_MODAL_OPEN_CLASS = 'perps-unifold-modal-open';

const UNIFOLD_DESTINATION_CHECK_TTL = 10 * 60 * 1000;
let cachedDestinationCheck: { ok: boolean; time: number } | undefined;

// Confirm the hardcoded HyperCore destination is still present in Unifold's
// supported list (veto only). Fails closed on any error. Result is cached to
// avoid a network round-trip on every deposit-modal open.
async function isHypercoreDestinationSupported(): Promise<boolean> {
  if (
    cachedDestinationCheck &&
    Date.now() - cachedDestinationCheck.time < UNIFOLD_DESTINATION_CHECK_TTL
  ) {
    return cachedDestinationCheck.ok;
  }
  let ok = false;
  try {
    const supported = await getSupportedDestinationTokens(
      UNIFOLD_PERPS_PUBLISHABLE_KEY,
    );
    ok = validateHypercoreDestination(supported.data, {
      chainId: UNIFOLD_HYPERCORE_CHAIN_ID,
      tokenAddress: UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
    });
  } catch {
    ok = false;
  }
  cachedDestinationCheck = { ok, time: Date.now() };
  return ok;
}

type IPerpsDepositAction =
  | 'onekey'
  | 'transfer'
  | 'card'
  | 'exchangePay'
  | 'exchangeConnect'
  | 'cashApp'
  | 'tracker';

type IUnifoldInitialScreen =
  | 'transfer'
  | 'card'
  | 'cashapp'
  | 'tracker'
  | 'pay_with_exchange'
  | 'exchange_connect';

type IUnifoldThemeMode = 'light' | 'dark';
type IPerpsDepositMethod = 'crypto' | 'cash';

const UNIFOLD_SCREEN_MAP: Partial<
  Record<IPerpsDepositAction, IUnifoldInitialScreen>
> = {
  transfer: 'transfer',
  card: 'card',
  exchangePay: 'pay_with_exchange',
  exchangeConnect: 'exchange_connect',
  cashApp: 'cashapp',
  tracker: 'tracker',
};

const PERPS_DEPOSIT_ACTIONS: Array<{
  value: IPerpsDepositAction;
  title: string;
  subtitle: string;
  icon: Parameters<typeof Icon>[0]['name'];
}> = [
  {
    value: 'onekey',
    title: 'Connected Wallet',
    subtitle: 'Min $5 • Instant',
    icon: 'WalletCryptoOutline',
  },
  {
    value: 'transfer',
    title: 'Transfer Crypto',
    subtitle: 'No limit • Instant',
    icon: 'QrCodeOutline',
  },
  {
    value: 'card',
    title: 'Deposit with Card',
    subtitle: '$50,000 limit',
    icon: 'CreditCardOutline',
  },
  {
    value: 'exchangePay',
    title: 'Pay with Exchange',
    subtitle: 'Transfer from exchange',
    icon: 'SwitchHorOutline',
  },
  {
    value: 'exchangeConnect',
    title: 'Connect Exchange',
    subtitle: 'No limit • 2 min',
    icon: 'StoreOutline',
  },
  {
    value: 'cashApp',
    title: 'Pay with Cash App',
    subtitle: 'Deposit via Cash App',
    icon: 'DollarOutline',
  },
  {
    value: 'tracker',
    title: 'Deposit Tracker',
    subtitle: 'Track your deposit progress',
    icon: 'ClockTimeHistoryOutline',
  },
];

const PERPS_DEPOSIT_ACTION_GROUPS: Record<
  IPerpsDepositMethod,
  IPerpsDepositAction[]
> = {
  crypto: ['onekey', 'transfer', 'exchangeConnect'],
  cash: ['card', 'exchangePay', 'cashApp', 'tracker'],
};

function usePerpsDepositHintLogos() {
  const { data: projectConfig } = useQuery({
    queryKey: ['unifold', 'project-config', UNIFOLD_PERPS_PUBLISHABLE_KEY],
    queryFn: () => getProjectConfig(UNIFOLD_PERPS_PUBLISHABLE_KEY),
    enabled: Boolean(UNIFOLD_PERPS_PUBLISHABLE_KEY),
    staleTime: UNIFOLD_QUERY_STALE_TIME,
  });
  const { data: integrationExchanges } = useQuery({
    queryKey: [
      'unifold',
      'integration-exchanges',
      UNIFOLD_PERPS_PUBLISHABLE_KEY,
    ],
    queryFn: () => getIntegrationExchanges(UNIFOLD_PERPS_PUBLISHABLE_KEY),
    enabled: Boolean(UNIFOLD_PERPS_PUBLISHABLE_KEY),
    staleTime: UNIFOLD_QUERY_STALE_TIME,
  });
  const { data: exchangeProviders } = useQuery({
    queryKey: ['unifold', 'exchange-providers', UNIFOLD_PERPS_PUBLISHABLE_KEY],
    queryFn: () => getExchanges(undefined, UNIFOLD_PERPS_PUBLISHABLE_KEY),
    enabled: Boolean(UNIFOLD_PERPS_PUBLISHABLE_KEY),
    staleTime: UNIFOLD_QUERY_STALE_TIME,
  });

  return useMemo<Partial<Record<IPerpsDepositAction, string[]>>>(() => {
    const transferLogos = (projectConfig?.transfer_crypto.networks ?? [])
      .toSorted((a, b) => a.position - b.position)
      .flatMap((network) => {
        const iconUrl = getPreferredIconUrl(network.icon_urls, 'png');
        return iconUrl ? [iconUrl] : [];
      });
    const exchangeLogos = (integrationExchanges?.data ?? [])
      .filter((exchange) => exchange.enabled)
      .flatMap((exchange) => {
        const iconUrl =
          getPreferredIconUrl(exchange.icon_urls, 'png') || exchange.icon_url;
        return iconUrl ? [iconUrl] : [];
      });
    const cardLogos = (projectConfig?.payment_networks.networks ?? []).flatMap(
      (network) => {
        const iconUrl = getPreferredIconUrl(network.icon_urls, 'svg');
        return iconUrl ? [iconUrl] : [];
      },
    );
    const payWithExchangeLogos = (exchangeProviders?.data ?? [])
      .filter((exchange) => exchange.enabled)
      .slice(0, 3)
      .flatMap((exchange) => {
        const iconUrl =
          getPreferredIconUrl(exchange.icon_urls, 'svg') || exchange.icon_url;
        return iconUrl ? [iconUrl] : [];
      });
    const cashAppLogo = projectConfig?.asset_cdn_url
      ? `${projectConfig.asset_cdn_url}/api/public/icons/onramps/svg/cashapp.svg`
      : undefined;

    return {
      transfer: transferLogos,
      card: cardLogos,
      exchangePay: payWithExchangeLogos,
      exchangeConnect: exchangeLogos,
      cashApp: cashAppLogo ? [cashAppLogo] : [],
    };
  }, [exchangeProviders, integrationExchanges, projectConfig]);
}

function PerpsDepositMethodLabel({
  method,
  active,
}: {
  method: IPerpsDepositMethod;
  active: boolean;
}) {
  return (
    <XStack alignItems="center" justifyContent="center" gap="$1">
      <Stack width="$5" height="$5" alignItems="center" justifyContent="center">
        <Icon
          name={method === 'crypto' ? 'BitcoinOutline' : 'DollarOutline'}
          color={active ? '$iconInverse' : '$icon'}
          size="$4"
        />
      </Stack>
      <SizableText
        size="$bodySmMedium"
        color={active ? '$textInverse' : '$text'}
        numberOfLines={1}
      >
        {method === 'crypto' ? 'Use Crypto' : 'Use Cash'}
      </SizableText>
    </XStack>
  );
}

function PerpsDepositHintDots({
  action,
  logos,
}: {
  action: IPerpsDepositAction;
  logos?: string[];
}) {
  if (!logos?.length) {
    return null;
  }

  if (action === 'card') {
    return (
      <XStack alignItems="center" gap="$1.5">
        {logos.map((logo) => (
          <Image
            key={logo}
            w="$5"
            h="$5"
            resizeMode="contain"
            source={{ uri: logo }}
          />
        ))}
      </XStack>
    );
  }

  if (action === 'cashApp') {
    return (
      <Image w="$4.5" h="$4.5" borderRadius="$1" source={{ uri: logos[0] }} />
    );
  }

  if (action === 'exchangeConnect' || action === 'exchangePay') {
    return (
      <XStack alignItems="center">
        {logos.map((logo, index) => (
          <Image
            key={logo}
            w="$5"
            h="$5"
            borderRadius="$full"
            borderWidth="$px"
            borderColor="$bgApp"
            source={{ uri: logo }}
            {...(index === 0 ? undefined : { ml: '$-1.5' })}
          />
        ))}
      </XStack>
    );
  }

  return (
    <XStack alignItems="center">
      {logos.map((tokenImageUri, index) => (
        <Token
          key={tokenImageUri}
          size="xxs"
          tokenImageUri={tokenImageUri}
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

function PerpsDepositActionRow({
  action,
  hintLogos,
  onPress,
}: {
  action: (typeof PERPS_DEPOSIT_ACTIONS)[number];
  hintLogos?: string[];
  onPress: (action: IPerpsDepositAction) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(action.value);
  }, [action.value, onPress]);

  return (
    <XStack
      minHeight="$13"
      borderRadius="$3"
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$2.5"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
    >
      <Stack width="$7" alignItems="center">
        <Icon name={action.icon} color="$icon" size="$5" />
      </Stack>
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodySmMedium" color="$text" numberOfLines={1}>
          {action.title}
        </SizableText>
        <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
          {action.subtitle}
        </SizableText>
      </YStack>
      <PerpsDepositHintDots action={action.value} logos={hintLogos} />
      <Icon name="ChevronRightSmallOutline" color="$iconSubdued" size="$4" />
    </XStack>
  );
}

function PerpsUnifoldDepositModal({
  selectedAccount,
  onOneKeyWalletPress,
  onOpenChange,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  onOneKeyWalletPress: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const themeName = useThemeName();
  const [method, setMethod] = useState<IPerpsDepositMethod>('crypto');
  const hintLogos = usePerpsDepositHintLogos();
  const unifoldTheme: IUnifoldThemeMode =
    themeName === 'dark' ? 'dark' : 'light';

  const handleActionPress = useCallback(
    (action: IPerpsDepositAction) => {
      if (action === 'onekey') {
        onOpenChange(false);
        onOneKeyWalletPress();
        return;
      }

      const nextScreen = UNIFOLD_SCREEN_MAP[action];
      if (nextScreen) {
        onOpenChange(false);
        void showStandaloneUnifoldDepositModal({
          selectedAccount,
          initialScreen: nextScreen,
          theme: unifoldTheme,
        });
      }
    },
    [onOneKeyWalletPress, onOpenChange, selectedAccount, unifoldTheme],
  );

  const actions = PERPS_DEPOSIT_ACTIONS.filter((action) =>
    PERPS_DEPOSIT_ACTION_GROUPS[method].includes(action.value),
  );

  return (
    <YStack gap="$3" pb="$4" width="100%">
      <SegmentControl
        value={method}
        onChange={(value) => {
          setMethod(value as IPerpsDepositMethod);
        }}
        options={[
          {
            value: 'crypto',
            label: (
              <PerpsDepositMethodLabel
                method="crypto"
                active={method === 'crypto'}
              />
            ),
          },
          {
            value: 'cash',
            label: (
              <PerpsDepositMethodLabel
                method="cash"
                active={method === 'cash'}
              />
            ),
          },
        ]}
        fullWidth
      />
      <YStack gap="$1">
        {actions.map((action) => (
          <PerpsDepositActionRow
            key={action.value}
            action={action}
            hintLogos={hintLogos[action.value]}
            onPress={handleActionPress}
          />
        ))}
      </YStack>
    </YStack>
  );
}

// Headless host: the SDK owns the modal lifecycle. This component only kicks
// off `beginDeposit` once on mount; unmounting is driven by the SDK's `onClose`.
function UnifoldDepositLauncher({ config }: { config: DepositConfig }) {
  const { beginDeposit } = useUnifold();
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    // Rejection means the user cancelled the flow; UI feedback comes from
    // config.onError, so swallow it to avoid an unhandled rejection.
    void beginDeposit(config).catch(() => undefined);
  }, [beginDeposit, config]);
  return null;
}

async function showStandaloneUnifoldDepositModal({
  selectedAccount,
  initialScreen,
  theme,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  initialScreen: IUnifoldInitialScreen;
  theme: IUnifoldThemeMode;
}) {
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    Toast.error({ title: 'Unifold is not configured' });
    return;
  }

  // Fail-closed: re-read the active account at mount time and require the
  // recipient to equal it. A mismatch aborts instead of depositing to a stale
  // or empty address.
  const activeAccount = jotaiDefaultStore.get(perpsActiveAccountAtom.atom());
  const safeRecipient = getSafeUnifoldRecipient({
    recipient: selectedAccount.accountAddress,
    activeAccountAddress: activeAccount.accountAddress,
  });
  if (!safeRecipient) {
    Toast.error({
      title: 'Deposit unavailable',
      message: 'Account address mismatch',
    });
    return;
  }

  // Veto: the hardcoded HyperCore destination must still be in Unifold's
  // supported list. Remote config can disable the flow, never redirect it.
  if (!(await isHypercoreDestinationSupported())) {
    Toast.error({
      title: 'Deposit unavailable',
      message: 'Destination config mismatch',
    });
    return;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  document.body.classList.add(PERPS_UNIFOLD_MODAL_OPEN_CLASS);
  const root = createRoot(container);

  let settled = false;
  const close = () => {
    if (settled) {
      return;
    }
    settled = true;
    root.unmount();
    container.remove();
    document.body.classList.remove(PERPS_UNIFOLD_MODAL_OPEN_CLASS);
  };

  const depositConfig: DepositConfig = {
    externalUserId: safeRecipient,
    destinationChainType: 'ethereum',
    destinationChainId: UNIFOLD_HYPERCORE_CHAIN_ID,
    destinationTokenAddress: UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
    destinationTokenSymbol: UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
    recipientAddress: safeRecipient,
    defaultSourceChainType: 'ethereum',
    defaultSourceChainId: '42161',
    defaultSourceTokenAddress: USDC_TOKEN_INFO.address,
    defaultSourceSymbol: USDC_TOKEN_INFO.symbol,
    initialScreen,
    onSuccess: ({ message }) => {
      Toast.success({ title: message || 'Deposit submitted' });
      // Mirror the native deposit flow: force the ledger subscription so the
      // credited balance and account history refresh without a manual reload.
      void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
    },
    onError: ({ message }) => {
      Toast.error({ title: message || 'Deposit failed' });
    },
    onClose: () => {
      close();
    },
  };

  root.render(
    <UnifoldProvider
      publishableKey={UNIFOLD_PERPS_PUBLISHABLE_KEY}
      config={{
        modalTitle: 'Deposit Crypto',
        appearance: theme,
        displayMode: 'stacked',
        transferInputVariant: 'double_input',
        browserWalletAmountQuickSelect: 'percentage',
        enableTransferCrypto: true,
        enableConnectWallet: true,
        enableFiatOnramp: true,
        enablePayWithExchange: true,
        enableConnectExchange: true,
        enableCashApp: true,
      }}
    >
      <UnifoldDepositLauncher config={depositConfig} />
    </UnifoldProvider>,
  );
}

export function showPerpsUnifoldDepositTracker({
  selectedAccount,
  theme,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  theme: 'light' | 'dark';
}) {
  void showStandaloneUnifoldDepositModal({
    selectedAccount,
    initialScreen: 'tracker',
    theme,
  });
}

export function showPerpsUnifoldDepositDialog({
  selectedAccount,
  onOneKeyWalletPress,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  onOneKeyWalletPress: () => void;
}) {
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    onOneKeyWalletPress();
    return;
  }

  const dialog = Dialog.show({
    title: 'Deposit',
    showFooter: false,
    renderContent: (
      <QueryClientProvider client={unifoldQueryClient}>
        <PerpsUnifoldDepositModal
          selectedAccount={selectedAccount}
          onOneKeyWalletPress={onOneKeyWalletPress}
          onOpenChange={(open) => {
            if (!open) {
              void dialog.close();
            }
          }}
        />
      </QueryClientProvider>
    ),
  });
}
