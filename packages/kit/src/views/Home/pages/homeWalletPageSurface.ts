import type { IHomeWalletContentReadiness } from './homePageNoWalletContent';
import type { IOnboardingLaunchDecision } from '../../Onboarding/components/onboardingLaunchGate';

export type IHomeWalletPageSurface =
  | 'pending'
  | 'no-wallet'
  | 'native'
  | 'react';

export type IHomeWalletPageSurfaceState = {
  accountId?: string;
  authority?: 'active' | 'cached' | 'confirmed';
  surface: IHomeWalletPageSurface;
  walletId?: string;
};

export type IHomeWalletPageSurfaceWallet = {
  id?: string;
  type?: string;
  backuped?: boolean;
};

function resolveNormalWalletSurface(nativeHomeEnabled: boolean) {
  return nativeHomeEnabled ? ('native' as const) : ('react' as const);
}

export function resolveHomeWalletPageSurface({
  launchDecision,
  walletContentReadiness,
  activeAccountId,
  activeWallet,
  walletListWallet,
  nativeHomeEnabled,
  walletRendererReady,
  previous,
  retainPreviousOwnerWhilePending = false,
}: {
  launchDecision: IOnboardingLaunchDecision;
  walletContentReadiness: IHomeWalletContentReadiness;
  activeAccountId?: string;
  activeWallet: IHomeWalletPageSurfaceWallet | undefined;
  walletListWallet: IHomeWalletPageSurfaceWallet | undefined;
  nativeHomeEnabled: boolean;
  walletRendererReady: boolean;
  previous?: IHomeWalletPageSurfaceState;
  retainPreviousOwnerWhilePending?: boolean;
}): IHomeWalletPageSurfaceState {
  const activeWalletId = activeWallet?.id;
  const activeOwner = {
    ...(activeAccountId ? { accountId: activeAccountId } : {}),
    walletId: activeWalletId,
  };
  const pending = (): IHomeWalletPageSurfaceState => {
    const previousMatchesActiveOwner =
      previous?.walletId === activeWalletId &&
      previous?.accountId === activeAccountId;
    if (
      previous &&
      previous.surface !== 'pending' &&
      (previousMatchesActiveOwner || retainPreviousOwnerWhilePending)
    ) {
      return previous;
    }
    return { surface: 'pending', ...activeOwner };
  };

  if (launchDecision !== 'main') {
    return { surface: 'pending', ...activeOwner };
  }
  if (walletContentReadiness === 'no-wallet') {
    return { surface: 'no-wallet' };
  }
  if (!walletRendererReady) {
    return pending();
  }
  if (
    walletContentReadiness === 'cached-wallet' ||
    walletContentReadiness === 'active-wallet'
  ) {
    if (!activeAccountId || !activeWalletId || !activeWallet?.type) {
      return pending();
    }
    return {
      surface: resolveNormalWalletSurface(nativeHomeEnabled),
      authority:
        walletContentReadiness === 'cached-wallet' ? 'cached' : 'active',
      ...activeOwner,
    };
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

  return {
    surface: resolveNormalWalletSurface(nativeHomeEnabled),
    authority: 'confirmed',
    ...activeOwner,
  };
}
