import type { IHomeWalletContentReadiness } from './homePageNoWalletContent';
import type { IOnboardingLaunchDecision } from '../../Onboarding/components/onboardingLaunchGate';

export type IHomeWalletPageSurface =
  | 'pending'
  | 'no-wallet'
  | 'native'
  | 'react';

export type IHomeWalletPageSurfaceState = {
  accountId?: string;
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
  previous,
}: {
  launchDecision: IOnboardingLaunchDecision;
  walletContentReadiness: IHomeWalletContentReadiness;
  activeAccountId?: string;
  activeWallet: IHomeWalletPageSurfaceWallet | undefined;
  walletListWallet: IHomeWalletPageSurfaceWallet | undefined;
  nativeHomeEnabled: boolean;
  previous?: IHomeWalletPageSurfaceState;
}): IHomeWalletPageSurfaceState {
  const activeWalletId = activeWallet?.id;
  const activeOwner = {
    ...(activeAccountId ? { accountId: activeAccountId } : {}),
    walletId: activeWalletId,
  };
  const pending = (): IHomeWalletPageSurfaceState => {
    const walletIdentityConfirmed =
      Boolean(activeWalletId) &&
      activeWalletId === walletListWallet?.id &&
      Boolean(activeWallet?.type) &&
      activeWallet?.type === walletListWallet?.type;
    const sameOwner =
      Boolean(previous) &&
      previous?.walletId === activeWalletId &&
      previous?.accountId === activeAccountId;
    const normalSurface = resolveNormalWalletSurface(nativeHomeEnabled);
    if (
      walletIdentityConfirmed &&
      sameOwner &&
      previous?.surface === normalSurface
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
    ...activeOwner,
  };
}
