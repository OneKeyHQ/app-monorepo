import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { IUnsignedMessageEth } from '@onekeyhq/core/src/types';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { validateTypedSignMessageDataV3V4 } from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { WcPayUserCancelledError } from './wcPayInlineUtils';

import type { IWcPayInlinePhase } from './wcPayInlineUtils';

export type IWcPayInlineSignResult =
  // the signature the caller must hand back to the Pay server
  | { status: 'ok'; signature: string }
  // a pre-sign blocker: the confirm page owns the decision from here
  | { status: 'fallback'; reason: string }
  // ended without a signature and without an error to report — another
  // component has already told the user why
  | { status: 'abort' };

/**
 * The two ways a user declines a headless signature: dismissing the
 * password/passcode prompt (`servicePassword.promptPasswordVerifyByAccount`
 * rejects with `PasswordPromptDialogCancel`) or refusing on the hardware
 * device. Matched on error class and hardware code — never on message text,
 * which is localized and vendor-supplied. Anything else is a real failure and
 * must keep its identity.
 */
function isWcPaySignUserCancel(error: unknown): boolean {
  const oneKeyError = error as IOneKeyError | undefined;
  if (
    oneKeyError?.className === EOneKeyErrorClassNames.PasswordPromptDialogCancel
  ) {
    return true;
  }
  return Boolean(
    isHardwareErrorByCode({
      error: oneKeyError,
      code: [
        HardwareErrorCode.ActionCancelled,
        HardwareErrorCode.PinCancelled,
        HardwareErrorCode.CallQueueActionCancelled,
      ],
    }),
  );
}

/**
 * Headless counterpart of `MessageConfirmActions.handleSignMessage` for the WC
 * Pay Permit2 leg: the same backup gate, the same pre-sign validation, the
 * same unsigned message, and the same signature-history write the confirm page
 * performs — only without the page.
 *
 * The failure contract mirrors the inline send pipeline's asymmetry: every
 * problem BEFORE the service call is RETURNED as a fallback, because the
 * confirm page can still present the same payload and let the user decide;
 * from the service call onwards the outcome is either the signature, the
 * user's cancellation (`WcPayUserCancelledError`), or the original error
 * rethrown untouched. Nothing here broadcasts, so — unlike the send pipeline —
 * there is no post-sign flag to carry: a failed signature leaves no trace on
 * chain and the caller is free to route the action to its confirm page.
 *
 * `status: 'abort'` is not an error: the wallet-backup dialog has already told
 * the user what to do, so the caller must end the flow silently.
 */
export async function wcPayInlineSignTypedData({
  networkId,
  accountId,
  accountAddress,
  message,
  sourceInfo,
  throwIfCancelled,
  onPhase,
}: {
  networkId: string;
  accountId: string;
  // the signer, as the typed-data payload's `from` — validated against the
  // impl's address rules below, exactly as the confirm page validates it
  accountAddress: string;
  // the raw EIP-712 JSON string proven to match the order by
  // `getWcPayInlineMessagePlan`; signed verbatim, never re-serialized
  message: string;
  sourceInfo: IDappSourceInfo;
  // pre-sign cancellation boundary (page unmounted), supplied by the executor
  // as its own checker so its retirement rule applies here unchanged
  throwIfCancelled: () => void;
  onPhase?: (phase: IWcPayInlinePhase) => void;
}): Promise<IWcPayInlineSignResult> {
  const unsignedMessage: IUnsignedMessageEth = {
    type: EMessageTypesEth.TYPED_DATA_V4,
    message,
    payload: [accountAddress, message],
  };

  // Parity with MessageConfirmActions: a dapp-originated signature is blocked
  // while the wallet has no backup. The check SHOWS the backup dialog itself
  // and never rejects (it answers its own event and reports a failed check as
  // "not backed up"), so by the time it returns true the user has already been
  // told what to do and this pipeline only has to stop.
  //
  // Deliberately NOT a fallback: the confirm page runs the same check on
  // mount, where a not-backed-up wallet re-raises the dialog and the signature
  // silently returns — a page the user cannot sign from.
  const isNotBackedUp =
    await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
      walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
    });
  if (isNotBackedUp) {
    return { status: 'abort' };
  }

  try {
    const network = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    // The confirm page's own guard for TYPED_DATA_V3/V4: it re-checks the
    // payload against the schema and refuses a domain chainId that is not the
    // chain being signed on. Ordered before the cancel gate so a rejected
    // payload reaches the confirm page rather than the signer.
    await validateTypedSignMessageDataV3V4(
      unsignedMessage,
      networkUtils.getNetworkChainId({ networkId }),
      network.impl,
    );
  } catch (error) {
    return {
      status: 'fallback',
      reason:
        (error as Error | undefined)?.message || 'typed data validation failed',
    };
  }

  // Last pre-sign gate: past this point the signing session (hardware
  // especially) must run to completion rather than be abandoned.
  throwIfCancelled();
  onPhase?.('signingMessage');
  let signature: string;
  try {
    signature = await backgroundApiProxy.serviceSend.signMessage({
      networkId,
      accountId,
      unsignedMessage,
    });
  } catch (error) {
    if (isWcPaySignUserCancel(error)) {
      // Generic on purpose: this message can surface to the user, and the
      // underlying error may name the device or the prompt that raised it.
      throw new WcPayUserCancelledError('User canceled payment');
    }
    throw error;
  }

  // Signature-record parity with the confirm page. Bookkeeping only: the
  // signature exists and the caller still has to report it, so a failure here
  // must never turn a produced signature into a failed payment.
  try {
    await backgroundApiProxy.serviceSignature.addItemFromSignMessage({
      networkId,
      accountId,
      message,
      sourceInfo,
    });
  } catch (error) {
    console.error('wcPay inline sign message history write failed', error);
  }

  return { status: 'ok', signature };
}
