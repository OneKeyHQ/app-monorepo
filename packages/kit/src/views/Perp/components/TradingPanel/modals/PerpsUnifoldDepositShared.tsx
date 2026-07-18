// cspell: words cashapp onramps unifold Unifold hypercore Hypercore
import { useCallback, useMemo, useState } from 'react';

import {
  getExchanges,
  getIntegrationExchanges,
  getPreferredIconUrl,
  getProjectConfig,
  getSupportedDestinationTokens,
} from '@unifold/core';

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
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  type IPerpsActiveAccountAtom,
  perpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';

import {
  UNIFOLD_HYPERCORE_CHAIN_ID,
  UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
  UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
  UNIFOLD_PERPS_PUBLISHABLE_KEY,
} from '../../../consts/unifold';
import { validateHypercoreDestination } from '../../../utils/unifoldDestination';
import { getSafeUnifoldRecipient } from '../../../utils/unifoldRecipient';

const UNIFOLD_QUERY_STALE_TIME = 5 * 60 * 1000;
const UNIFOLD_DESTINATION_CHECK_TTL = 10 * 60 * 1000;

export type IPerpsDepositAction =
  | 'onekey'
  | 'transfer'
  | 'card'
  | 'exchangePay'
  | 'exchangeConnect'
  | 'cashApp'
  | 'tracker';

export type IUnifoldInitialScreen =
  | 'transfer'
  | 'card'
  | 'cashapp'
  | 'tracker'
  | 'pay_with_exchange'
  | 'exchange_connect';

export type IUnifoldThemeMode = 'light' | 'dark';
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

let cachedDestinationCheck: { ok: boolean; time: number } | undefined;

// Confirm the hardcoded HyperCore destination is still present in Unifold's
// supported list (veto only). Fails closed on any error. Result is cached to
// avoid a network round-trip on every deposit-modal open.
export async function isHypercoreDestinationSupported(): Promise<boolean> {
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

// Shared fail-closed guard sequence (Task 4 + Task 8). Returns the validated
// recipient or null after surfacing a Toast. Both platform launchers must call
// this before handing anything to the vendor SDK.
export async function runUnifoldDepositGuards(
  selectedAccount: IPerpsActiveAccountAtom,
): Promise<string | null> {
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    Toast.error({ title: 'Unifold is not configured' });
    return null;
  }

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
    return null;
  }

  if (!(await isHypercoreDestinationSupported())) {
    Toast.error({
      title: 'Deposit unavailable',
      message: 'Destination config mismatch',
    });
    return null;
  }

  return safeRecipient;
}

// Destination fields shared by the web and native SDK configs (identical names
// on both DepositConfig shapes).
export function buildUnifoldDepositDestination(safeRecipient: string) {
  return {
    externalUserId: safeRecipient,
    destinationChainType: 'ethereum' as const,
    destinationChainId: UNIFOLD_HYPERCORE_CHAIN_ID,
    destinationTokenAddress: UNIFOLD_HYPERCORE_USDC_PERP_ADDRESS,
    destinationTokenSymbol: UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
    recipientAddress: safeRecipient,
  };
}

interface IUnifoldHintLogosSource {
  projectConfig: Awaited<ReturnType<typeof getProjectConfig>> | undefined;
  integrationExchanges:
    | Awaited<ReturnType<typeof getIntegrationExchanges>>
    | undefined;
  exchangeProviders: Awaited<ReturnType<typeof getExchanges>> | undefined;
}

let cachedHintLogosSource:
  | { time: number; promise: Promise<IUnifoldHintLogosSource> }
  | undefined;

// Module-level cache replaces react-query's staleTime; allSettled keeps the
// three requests independent (one failure must not blank the other logos).
function fetchHintLogosSource(): Promise<IUnifoldHintLogosSource> {
  if (
    !cachedHintLogosSource ||
    Date.now() - cachedHintLogosSource.time > UNIFOLD_QUERY_STALE_TIME
  ) {
    const promise = Promise.allSettled([
      getProjectConfig(UNIFOLD_PERPS_PUBLISHABLE_KEY),
      getIntegrationExchanges(UNIFOLD_PERPS_PUBLISHABLE_KEY),
      getExchanges(undefined, UNIFOLD_PERPS_PUBLISHABLE_KEY),
    ]).then(([projectConfig, integrationExchanges, exchangeProviders]) => ({
      projectConfig:
        projectConfig.status === 'fulfilled' ? projectConfig.value : undefined,
      integrationExchanges:
        integrationExchanges.status === 'fulfilled'
          ? integrationExchanges.value
          : undefined,
      exchangeProviders:
        exchangeProviders.status === 'fulfilled'
          ? exchangeProviders.value
          : undefined,
    }));
    cachedHintLogosSource = { time: Date.now(), promise };
  }
  return cachedHintLogosSource.promise;
}

function usePerpsDepositHintLogos() {
  const { result } = usePromiseResult(
    async () => {
      if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
        return undefined;
      }
      return fetchHintLogosSource();
    },
    [],
    { watchLoading: false },
  );
  const projectConfig = result?.projectConfig;
  const integrationExchanges = result?.integrationExchanges;
  const exchangeProviders = result?.exchangeProviders;

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

function PerpsUnifoldDepositMenu({
  onOneKeyWalletPress,
  onOpenChange,
  onLaunchUnifold,
  excludeActions,
}: {
  onOneKeyWalletPress: () => void;
  onOpenChange: (open: boolean) => void;
  onLaunchUnifold: (
    screen: IUnifoldInitialScreen,
    theme: IUnifoldThemeMode,
  ) => void;
  excludeActions?: IPerpsDepositAction[];
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
        onLaunchUnifold(nextScreen, unifoldTheme);
      }
    },
    [onLaunchUnifold, onOneKeyWalletPress, onOpenChange, unifoldTheme],
  );

  const actions = PERPS_DEPOSIT_ACTIONS.filter(
    (action) =>
      PERPS_DEPOSIT_ACTION_GROUPS[method].includes(action.value) &&
      !excludeActions?.includes(action.value),
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

export function showPerpsUnifoldDepositMenuDialog({
  onOneKeyWalletPress,
  onLaunchUnifold,
  excludeActions,
}: {
  onOneKeyWalletPress: () => void;
  onLaunchUnifold: (
    screen: IUnifoldInitialScreen,
    theme: IUnifoldThemeMode,
  ) => void;
  excludeActions?: IPerpsDepositAction[];
}) {
  const dialog = Dialog.show({
    title: 'Deposit',
    showFooter: false,
    renderContent: (
      <PerpsUnifoldDepositMenu
        onOneKeyWalletPress={onOneKeyWalletPress}
        onLaunchUnifold={onLaunchUnifold}
        excludeActions={excludeActions}
        onOpenChange={(open) => {
          if (!open) {
            void dialog.close();
          }
        }}
      />
    ),
  });
}
