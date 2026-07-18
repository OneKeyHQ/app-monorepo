import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

import type { IHomeWalletContentReadiness } from './homePageNoWalletContent';
import type { IOnboardingLaunchDecision } from '../../Onboarding/components/onboardingLaunchGate';

export type IHomeWalletPageSurface =
  | 'pending'
  | 'no-wallet'
  | 'not-backed-up-rn'
  | 'native'
  | 'legacy';

export type IHomeWalletPageSurfaceState = {
  surface: IHomeWalletPageSurface;
  walletId?: string;
};

export type IHomeWalletPageSurfaceWallet = {
  id?: string;
  type?: string;
  backuped?: boolean;
};

function resolveNormalWalletSurface(nativeHomeEnabled: boolean) {
  return nativeHomeEnabled ? ('native' as const) : ('legacy' as const);
}

export function resolveHomeWalletPageSurface({
  launchDecision,
  walletContentReadiness,
  activeWallet,
  walletListWallet,
  nativeHomeEnabled,
  previous,
}: {
  launchDecision: IOnboardingLaunchDecision;
  walletContentReadiness: IHomeWalletContentReadiness;
  activeWallet: IHomeWalletPageSurfaceWallet | undefined;
  walletListWallet: IHomeWalletPageSurfaceWallet | undefined;
  nativeHomeEnabled: boolean;
  previous?: IHomeWalletPageSurfaceState;
}): IHomeWalletPageSurfaceState {
  const activeWalletId = activeWallet?.id;
  const pending = (): IHomeWalletPageSurfaceState => {
    if (
      activeWalletId &&
      previous?.surface === 'not-backed-up-rn' &&
      previous.walletId === activeWalletId
    ) {
      return previous;
    }
    return { surface: 'pending', walletId: activeWalletId };
  };

  if (launchDecision !== 'main') {
    return { surface: 'pending', walletId: activeWalletId };
  }
  if (walletContentReadiness === 'no-wallet') {
    return { surface: 'no-wallet' };
  }
  if (walletContentReadiness !== 'wallet') {
    return pending();
  }
  if (
    !activeWalletId ||
    activeWalletId !== walletListWallet?.id ||
    !activeWallet?.type ||
    activeWallet.type !== walletListWallet.type
  ) {
    return pending();
  }

  if (activeWallet.type !== WALLET_TYPE_HD) {
    return {
      surface: resolveNormalWalletSurface(nativeHomeEnabled),
      walletId: activeWalletId,
    };
  }
  // Surface ownership follows the authoritative backup verdict only. Balance
  // and portfolio data must never participate in this resolver.
  if (activeWallet.backuped === false && walletListWallet.backuped === false) {
    return { surface: 'not-backed-up-rn', walletId: activeWalletId };
  }
  if (activeWallet.backuped === true && walletListWallet.backuped === true) {
    return {
      surface: resolveNormalWalletSurface(nativeHomeEnabled),
      walletId: activeWalletId,
    };
  }
  return pending();
}
