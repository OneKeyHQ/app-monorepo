// cspell: words cashapp onramps unifold Unifold
import { useCallback, useMemo, useState } from 'react';

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  getExchanges,
  getIntegrationExchanges,
  getPreferredIconUrl,
  getProjectConfig,
} from '@unifold/core';
import { DepositModal, ThemeProvider } from '@unifold/ui-react';
import '@unifold/ui-react/styles-base.css';
import '@unifold/ui-react/styles.css';
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
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import {
  UNIFOLD_HYPERCORE_CHAIN_ID,
  UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
  UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
  UNIFOLD_PERPS_PUBLISHABLE_KEY,
} from '../../../consts/unifold';

import './PerpsUnifoldDepositModal.web.css';

const unifoldQueryClient = new QueryClient();
const UNIFOLD_QUERY_STALE_TIME = 5 * 60 * 1000;
const PERPS_UNIFOLD_MODAL_OPEN_CLASS = 'perps-unifold-modal-open';

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
        showStandaloneUnifoldDepositModal({
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

function showStandaloneUnifoldDepositModal({
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

  const container = document.createElement('div');
  document.body.appendChild(container);
  document.body.classList.add(PERPS_UNIFOLD_MODAL_OPEN_CLASS);
  const root = createRoot(container);

  const close = () => {
    root.unmount();
    container.remove();
    document.body.classList.remove(PERPS_UNIFOLD_MODAL_OPEN_CLASS);
  };

  root.render(
    <QueryClientProvider client={unifoldQueryClient}>
      <ThemeProvider mode={theme}>
        <DepositModal
          open
          onOpenChange={(open) => {
            if (!open) {
              close();
            }
          }}
          userId={
            selectedAccount.accountAddress || selectedAccount.accountId || ''
          }
          publishableKey={UNIFOLD_PERPS_PUBLISHABLE_KEY}
          modalTitle="Deposit Crypto"
          destinationChainType="ethereum"
          destinationChainId={UNIFOLD_HYPERCORE_CHAIN_ID}
          destinationTokenAddress={UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS}
          destinationTokenSymbol={UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL}
          recipientAddress={selectedAccount.accountAddress || ''}
          defaultSourceChainType="ethereum"
          defaultSourceChainId="42161"
          defaultSourceTokenAddress={USDC_TOKEN_INFO.address}
          defaultSourceSymbol={USDC_TOKEN_INFO.symbol}
          theme={theme}
          initialScreen={initialScreen}
          displayMode="stacked"
          transferInputVariant="double_input"
          browserWalletAmountQuickSelect="percentage"
          enableTransferCrypto
          enableConnectWallet
          enableFiatOnramp
          enablePayWithExchange
          enableConnectExchange
          enableCashApp
          onDepositSuccess={({ message }) => {
            Toast.success({ title: message || 'Deposit submitted' });
          }}
          onDepositError={({ message }) => {
            Toast.error({ title: message || 'Deposit failed' });
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

export function showPerpsUnifoldDepositTracker({
  selectedAccount,
  theme,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  theme: 'light' | 'dark';
}) {
  showStandaloneUnifoldDepositModal({
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
