import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ICheckWalletBindStatusResponse } from '@onekeyhq/shared/src/referralCode/type';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { flushPendingExistingWalletSwitchToast } from '../../../utils/toastExistingWalletSwitch';

import type { IShowOnboardingInviteCodeDialog } from '../components/OnboardingInviteCodeDialog';

type IOnboardingCompletion = {
  getCreatedWallet: () => IDBWallet | undefined;
  getReferralCheck: () => Promise<ICheckWalletBindStatusResponse | undefined>;
  getInviteDialog: () => IShowOnboardingInviteCodeDialog | null;
  isClosed: () => boolean;
  closePage: () => void;
  openKeylessAutoConnectDappModal: () => Promise<void>;
};

// UI-runtime only. The owning completion page removes its context on unmount;
// navigation carries only the route key, never callbacks or persisted state.
const completions = new Map<
  string,
  { context: IOnboardingCompletion; pending: boolean }
>();

export function registerOnboardingCompletion(
  routeKey: string,
  context: IOnboardingCompletion,
) {
  const entry = { context, pending: false };
  completions.set(routeKey, entry);
  return () => {
    if (completions.get(routeKey) === entry) completions.delete(routeKey);
  };
}

export async function enterWalletAfterOnboarding(
  routeKey: string,
  beforeEnter?: () => Promise<void>,
): Promise<boolean> {
  const entry = completions.get(routeKey);
  if (!entry) return false;
  const { context } = entry;
  if (entry.pending || context.isClosed()) return true;
  entry.pending = true;
  const isActive = () =>
    completions.get(routeKey) === entry && !context.isClosed();
  let waitingForInvite = false;
  const proceedToWallet = () => {
    if (!isActive()) return;
    context.closePage();
    flushPendingExistingWalletSwitchToast();
    void (async () => {
      await timerUtils.wait(600);
      await context.openKeylessAutoConnectDappModal();
    })();
  };

  try {
    // A gift success modal must leave before the owner's in-page dialog opens.
    await beforeEnter?.();
    if (!isActive()) return true;
    const createdWallet = context.getCreatedWallet();
    if (createdWallet) {
      try {
        const checkResp = await createTimeoutPromise({
          asyncFunc: async () => {
            try {
              return await context.getReferralCheck();
            } catch {
              return undefined;
            }
          },
          timeout: 1500,
          timeoutResult: undefined,
        });
        if (!isActive()) return true;
        const showInviteDialog = context.getInviteDialog();
        if (
          checkResp &&
          !checkResp.data &&
          checkResp.reason !== 'already_bound' &&
          checkResp.reason !== 'exceeded_bind_window' &&
          showInviteDialog
        ) {
          waitingForInvite = true;
          showInviteDialog({ wallet: createdWallet, onDone: proceedToWallet });
          return true;
        }
      } catch {
        // Keep the existing fail-open policy for unavailable referral services.
        waitingForInvite = false;
      }
    }
    proceedToWallet();
    return true;
  } finally {
    if (!waitingForInvite) entry.pending = false;
  }
}
