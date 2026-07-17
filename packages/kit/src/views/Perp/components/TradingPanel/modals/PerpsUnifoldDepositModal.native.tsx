// cspell: words unifold Unifold
import { Toast } from '@onekeyhq/components';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// Native placeholder. The web Unifold SDK (`@unifold/connect-react` +
// `react-dom/client`) must never reach the RN bundle, so native keeps the
// existing OneKey deposit flow until the RN SDK is wired up (see Task 14b).
export function showPerpsUnifoldDepositDialog({
  onOneKeyWalletPress,
}: {
  selectedAccount: IPerpsActiveAccountAtom;
  onOneKeyWalletPress: () => void;
}) {
  onOneKeyWalletPress();
}

export function showPerpsUnifoldDepositTracker(_params: {
  selectedAccount: IPerpsActiveAccountAtom;
  theme: 'light' | 'dark';
}) {
  Toast.message({
    title: 'Unifold',
    message: 'Deposit tracker is not available on native yet.',
  });
}
