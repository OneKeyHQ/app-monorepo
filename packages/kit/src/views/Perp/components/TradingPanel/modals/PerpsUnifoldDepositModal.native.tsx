// cspell: words unifold Unifold cashapp

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { UNIFOLD_PERPS_PUBLISHABLE_KEY } from '../../../consts/unifold';

import {
  type IPerpsDepositAction,
  type IUnifoldInitialScreen,
  buildUnifoldDepositDestination,
  runUnifoldDepositGuards,
  showPerpsUnifoldDepositMenuDialog,
} from './PerpsUnifoldDepositShared';
import { getNativeUnifoldBeginDeposit } from './unifoldNativeBridge';

import type { DepositConfig } from '@unifold/connect-react-native';

// Native Unifold is intentionally enabled on this branch. SDK 0.1.57's
// bottom sheet can leave a transparent native Modal surface intercepting every
// touch while its content is not visible. The patch-package fix keeps only the
// root Deposit sheet inline while preserving the SDK animation. Nested iOS
// sheets use a full-window overlay instead of creating a Modal surface inside
// another native overlay; Android keeps the SDK Modal behavior. The native
// host mounts the root sheet in OneKey's full-window overlay portal. Keep this
// fuse as the immediate fallback if a future SDK update invalidates either
// side of that integration.
const NATIVE_UNIFOLD_DISABLED = false;

// RN SDK 0.1.57 has no exchange screens, and Cash App is iOS-only per the
// Unifold platform matrix, so those menu entries are hidden on native.
const NATIVE_EXCLUDED_ACTIONS: IPerpsDepositAction[] = [
  'exchangePay',
  'exchangeConnect',
  ...(platformEnv.isNativeAndroid
    ? (['cashApp'] as IPerpsDepositAction[])
    : []),
];

// Screens the RN SDK's DepositInitialScreen union actually supports. The
// excluded menu entries above make the exchange screens unreachable; this is
// a fail-closed backstop rather than a cast.
type INativeUnifoldScreen = Extract<
  IUnifoldInitialScreen,
  'transfer' | 'card' | 'cashapp' | 'tracker'
>;

function toNativeUnifoldScreen(
  screen: IUnifoldInitialScreen,
): INativeUnifoldScreen | null {
  if (
    screen === 'transfer' ||
    screen === 'card' ||
    screen === 'cashapp' ||
    screen === 'tracker'
  ) {
    return screen;
  }
  return null;
}

async function showStandaloneUnifoldDepositModal({
  selectedAccount,
  initialScreen,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  initialScreen: IUnifoldInitialScreen;
}) {
  const nativeScreen = toNativeUnifoldScreen(initialScreen);
  if (!nativeScreen) {
    Toast.error({
      title: 'Deposit unavailable',
      message: 'Channel not supported on this platform',
    });
    return;
  }

  const safeRecipient = await runUnifoldDepositGuards(selectedAccount);
  if (!safeRecipient) {
    return;
  }

  const beginDeposit = getNativeUnifoldBeginDeposit();
  if (!beginDeposit) {
    // Host not mounted (Perp page tree absent) — never silently continue.
    Toast.error({
      title: 'Deposit unavailable',
      message: 'Unifold host is not ready',
    });
    return;
  }

  const depositConfig: DepositConfig = {
    ...buildUnifoldDepositDestination(safeRecipient),
    defaultChainType: 'ethereum',
    defaultChainId: '42161',
    defaultTokenAddress: USDC_TOKEN_INFO.address,
    initialScreen: nativeScreen,
    closeOnBackdropPress: true,
    onSuccess: ({ message }) => {
      Toast.success({ title: message || 'Deposit submitted' });
      // Mirror the web flow: force the ledger subscription so the credited
      // balance and account history refresh without a manual reload.
      void backgroundApiProxy.serviceHyperliquidSubscription.enableLedgerUpdatesSubscription();
    },
    onError: ({ message }) => {
      Toast.error({ title: message || 'Deposit failed' });
    },
  };

  void beginDeposit(depositConfig).catch((error: unknown) => {
    // The SDK also rejects on plain user cancellation; only surface real
    // failures so a manual dismiss stays silent.
    const errorRecord =
      error && typeof error === 'object'
        ? (error as Record<string, unknown>)
        : undefined;
    const message =
      (typeof errorRecord?.message === 'string' && errorRecord.message) ||
      (error instanceof Error ? error.message : '') ||
      (() => {
        try {
          return JSON.stringify(
            error,
            error instanceof Error ? Object.getOwnPropertyNames(error) : null,
          );
        } catch {
          return String(error);
        }
      })();
    if (message && !/cancel/i.test(message)) {
      console.error('[unifold-native] beginDeposit rejected:', error);
      const code =
        typeof errorRecord?.code === 'string' ? ` (${errorRecord.code})` : '';
      Toast.error({ title: 'Deposit failed', message: `${message}${code}` });
    }
  });
}

export function showPerpsUnifoldDepositTracker({
  selectedAccount,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  theme: 'light' | 'dark';
}) {
  if (NATIVE_UNIFOLD_DISABLED) {
    return;
  }
  void showStandaloneUnifoldDepositModal({
    selectedAccount,
    initialScreen: 'tracker',
  });
}

export function showPerpsUnifoldDepositDialog({
  selectedAccount,
  onOneKeyWalletPress,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  onOneKeyWalletPress: () => void;
}) {
  if (NATIVE_UNIFOLD_DISABLED || !UNIFOLD_PERPS_PUBLISHABLE_KEY) {
    onOneKeyWalletPress();
    return;
  }

  showPerpsUnifoldDepositMenuDialog({
    onOneKeyWalletPress,
    excludeActions: NATIVE_EXCLUDED_ACTIONS,
    onLaunchUnifold: (screen) => {
      void showStandaloneUnifoldDepositModal({
        selectedAccount,
        initialScreen: screen,
      });
    },
  });
}
