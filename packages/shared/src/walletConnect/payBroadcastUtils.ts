import { EWcPayActionMethod, type IWcPayAction } from './payTypes';

// copy pending product i18n keys
export const WC_PAY_BROADCAST_UNSUPPORTED_MESSAGE =
  'On-chain payments are not supported on this platform';

/**
 * True when the action list contains an irreversible on-chain transfer.
 * Sign-only methods (typed data, personal_sign, Solana sign-only) are
 * excluded: re-executing them reproduces the same consumable artifact
 * instead of a second transfer, so they may run without durable progress.
 */
export function hasWcPayBroadcastAction(
  actions: IWcPayAction[] | undefined,
): boolean {
  return Boolean(
    actions?.some(
      (action) =>
        action.walletRpc.method === EWcPayActionMethod.EthSendTransaction,
    ),
  );
}

/**
 * Broadcast-capable actions must not start (or even collect compliance
 * data) when their txid cannot be durably recorded. Used both as the
 * options-page early check and as the getRequiredPaymentActions backstop.
 */
export function shouldRefuseWcPayWithoutDurableProgress({
  actions,
  supportsDurableProgress,
}: {
  actions: IWcPayAction[] | undefined;
  supportsDurableProgress: boolean;
}): boolean {
  return !supportsDurableProgress && hasWcPayBroadcastAction(actions);
}
