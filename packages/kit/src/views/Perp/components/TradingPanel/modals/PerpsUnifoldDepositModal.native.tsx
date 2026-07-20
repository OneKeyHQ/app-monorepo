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

// Rollout gate — NOT a "broken SDK" fuse. The native flow is verified working:
// with @unifold/connect-react-native 0.1.57 the HyperCore (chain 1337) deposit
// sheet renders, funds route to the Perp destination, and it closes cleanly.
// The SDK's one blocker — its bottom-sheet entrance never lands under
// react-native-reanimated 4 (the sheet's useAnimatedStyle callbacks aren't
// compiled as worklets, so the spring never drives translateY and the sheet
// parks offscreen, leaving a transparent full-screen root that swallows
// touches) — is fixed locally in
// patches/@unifold+connect-react-native+0.1.57.patch
// (translateY pinned to 0). We patch UI defects ourselves rather than block on
// a vendor release.
// This stays true until: (1) a real-money native deposit is confirmed
// end-to-end, (2) Android device QA passes (the same patch covers it), and
// (3) the perp-config remote kill switch lands (Task 9). Flip to false to
// enable, gated by that remote switch.
const NATIVE_UNIFOLD_DISABLED = true;

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
    console.error('[unifold-native] beginDeposit rejected:', error);
    if (message && !/cancel/i.test(message)) {
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
