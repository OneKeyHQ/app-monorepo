// cspell: words unifold Unifold
import { Toast } from '@onekeyhq/components';
import type { IPerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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
    title: 'Unifold demo',
    message: 'Deposit Tracker is available in the web Unifold SDK demo.',
  });
}
