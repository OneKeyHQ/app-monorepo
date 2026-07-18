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

  // Rejection means the user cancelled the flow; UI feedback comes from
  // onError, so swallow it to avoid an unhandled rejection.
  void beginDeposit(depositConfig).catch(() => undefined);
}

export function showPerpsUnifoldDepositTracker({
  selectedAccount,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  theme: 'light' | 'dark';
}) {
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
  if (!UNIFOLD_PERPS_PUBLISHABLE_KEY) {
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
