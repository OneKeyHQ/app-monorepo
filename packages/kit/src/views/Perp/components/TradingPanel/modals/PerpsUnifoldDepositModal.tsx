// cspell: words unifold Unifold
import { useEffect, useRef } from 'react';

import {
  type DepositConfig,
  UnifoldProvider,
  useUnifold,
} from '@unifold/connect-react';
import '@unifold/connect-react/styles-base.css';
import '@unifold/connect-react/styles.css';
import { createRoot } from 'react-dom/client';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USDC_TOKEN_INFO } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { UNIFOLD_PERPS_PUBLISHABLE_KEY } from '../../../consts/unifold';

import './PerpsUnifoldDepositModal.css';
import {
  type IUnifoldInitialScreen,
  type IUnifoldThemeMode,
  buildUnifoldDepositDestination,
  runUnifoldDepositGuards,
  showPerpsUnifoldDepositMenuDialog,
} from './PerpsUnifoldDepositShared';

const PERPS_UNIFOLD_MODAL_OPEN_CLASS = 'perps-unifold-modal-open';

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
  const safeRecipient = await runUnifoldDepositGuards(selectedAccount);
  if (!safeRecipient) {
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
    ...buildUnifoldDepositDestination(safeRecipient),
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

  showPerpsUnifoldDepositMenuDialog({
    onOneKeyWalletPress,
    onLaunchUnifold: (screen, theme) => {
      void showStandaloneUnifoldDepositModal({
        selectedAccount,
        initialScreen: screen,
        theme,
      });
    },
  });
}
