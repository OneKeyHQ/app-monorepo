import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import type { IWcPayOption } from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  WcPayUserCancelledError,
  isWcPayInlineUserCancel,
  wcPayInlineSignFallbackReason,
} from './wcPayInlineUtils';

import type {
  IWcPayInlinePhase,
  IWcPayInlineSolanaSignResult,
} from './wcPayInlineUtils';

/**
 * Headless sign-only counterpart of the TxConfirm push for a WalletConnect Pay
 * Solana action whose blob already matched the order. Parity target is the
 * confirm page's sign-only path (`ServiceSend.batchSignAndSendTransaction` with
 * `signOnly: true`): the same `signTransaction` call, the same signature
 * record, and — as there — NO local history save, because nothing is
 * broadcast.
 *
 * No fee info is ever attached: the sol vault rewrites the message only when
 * fee info is present (`updateUnsignedTx` → `attachFeeInfoToEncodedTx`), and
 * the post-sign identity check below is what proves nothing rewrote it. The
 * confirm-page path relies on `feeInfoEditable: false` for the same reason;
 * omitting the fee entirely is the headless equivalent.
 *
 * Failure contract, as in the typed-data pipeline: every problem BEFORE the
 * service call is RETURNED as a fallback (the confirm page can still present
 * the same payload), and from the service call onwards the outcome is the
 * signed transaction, the user's cancellation (`WcPayUserCancelledError`), or
 * the original error rethrown untouched. The two exceptions THROW: the
 * account-binding guard (an internal wiring bug the confirm page would
 * reproduce rather than resolve) and the identity check (a transaction that
 * changed under us must never be submitted, not re-presented for approval).
 *
 * `status: 'abort'` is not an error: the wallet-backup dialog has already told
 * the user what to do, so the caller must end the flow silently.
 */
export async function wcPayInlineSignSolanaTx({
  networkId,
  accountId,
  accountAddress,
  option,
  unsignedTx,
  txBase64,
  sourceInfo,
  throwIfCancelled,
  onPhase,
}: {
  networkId: string;
  accountId: string;
  // the paying account as the executor resolved it for this action; validated
  // against the address the signing key itself derives, below
  accountAddress: string;
  // the approved order this signature belongs to; its account is what the
  // signing account must match
  option: IWcPayOption;
  // the very unsigned tx the confirm page would have shown, built by
  // `prepareSendConfirmUnsignedTx` from the server's blob
  unsignedTx: IUnsignedTxPro;
  // the server blob proven to match the order, kept as the reference the
  // signed transaction is compared against
  txBase64: string;
  sourceInfo: IDappSourceInfo;
  // pre-sign cancellation boundary (page unmounted), supplied by the executor
  // as its own checker so its retirement rule applies here unchanged
  throwIfCancelled: () => void;
  onPhase?: (phase: IWcPayInlinePhase) => void;
}): Promise<IWcPayInlineSolanaSignResult> {
  // Checked before the backup check, which RAISES A DIALOG as a side
  // effect: an already-cancelled flow must not put one on screen.
  throwIfCancelled();

  // Parity with TxConfirmActions: a dapp-originated signature is blocked while
  // the wallet has no backup. The check SHOWS the backup dialog itself and
  // never rejects, so by the time it returns true the user has already been
  // told what to do and this pipeline only has to stop.
  //
  // Deliberately NOT a fallback: the confirm page runs the same check on
  // mount, where a not-backed-up wallet re-raises the dialog and the submit
  // silently returns — a page the user cannot sign from.
  const isNotBackedUp =
    await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
      walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
    });
  if (isNotBackedUp) {
    return { status: 'abort' };
  }

  // Bind the ORDER to the KEY behind `accountId` — the key that actually
  // signs, resolved here rather than trusted from an argument. A signed Solana
  // payment moves funds from whoever signed it, so a caller wired to the wrong
  // account would spend from an account the user never approved.
  //
  // `accountAddress` is the caller's own idea of the payer and is checked
  // against the same derived address, so a mis-resolved account cannot slip
  // past by agreeing only with the option.
  let signerAddress: string;
  try {
    signerAddress =
      await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
  } catch (error) {
    // Same disposition as the send leg's 'prepare' stage: an address we could
    // not resolve is an unknown blocker, not a verdict about the account.
    return {
      status: 'fallback',
      reason: wcPayInlineSignFallbackReason(
        error,
        'failed to resolve the signing account',
      ),
    };
  }

  const optionAddress = option.account.split(':')[2];
  // Strict equality, never case-folded: base58 encodes case as data, so two
  // Solana addresses differing in case are two different accounts.
  if (
    !optionAddress ||
    !signerAddress ||
    !accountAddress ||
    optionAddress !== signerAddress ||
    accountAddress !== signerAddress
  ) {
    console.error(
      'wcPay inline account mismatch: option account',
      optionAddress,
      'signing account',
      signerAddress,
      'payload account',
      accountAddress,
    );
    throw new WcPayError({
      code: EWcPayErrorCode.CannotCompleteNow,
      message: 'This payment cannot be completed right now',
    });
  }

  // Last pre-sign gate: past this point the signing session (hardware
  // especially) must run to completion rather than be abandoned.
  throwIfCancelled();
  onPhase?.('signingMessage');
  let signedTx: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceSend.signTransaction>
  >;
  try {
    // Exactly what the confirm page's sign-only path calls
    // (ServiceSend.batchSignAndSendTransaction), fee info deliberately absent.
    //
    // One transaction per action, never a batch: the batch path refreshes
    // every tx after the first (`refreshUnsignedTxBeforeBatchSign`, which
    // rewrites the sol blockhash), and that rewrite would break the identity
    // check below. Anyone batching WC Pay actions must revisit this.
    signedTx = await backgroundApiProxy.serviceSend.signTransaction({
      networkId,
      accountId,
      unsignedTx,
      signOnly: true,
    });
  } catch (error) {
    if (isWcPayInlineUserCancel(error)) {
      // Generic on purpose: this message can surface to the user, and the
      // underlying error may name the device or the prompt that raised it.
      throw new WcPayUserCancelledError('User canceled payment');
    }
    throw error;
  }

  // Belt to the pre-sign validator's suspenders: signing must add signatures
  // and change nothing else. The comparison runs in the background because it
  // decodes both blobs with @solana/web3.js, which must not enter this bundle.
  const rawTx = signedTx?.rawTx;
  const isUnchanged = rawTx
    ? await backgroundApiProxy.serviceWalletConnectPay.isSolanaMessageUnchanged(
        { unsignedBase64: txBase64, signedBase64: rawTx },
      )
    : false;
  // Compared against `true` rather than merely tested for truth: the verdict
  // is produced in the background and crosses the proxy, so only an explicit
  // `true` proves the message survived signing.
  if (!rawTx || isUnchanged !== true) {
    // Never a fallback: a transaction that no longer carries the checked
    // message must not be submitted at all, by this path or the confirm page.
    throw new WcPayError({
      code: EWcPayErrorCode.SignedTxMismatch,
      message: 'Signed transaction does not match the payment request',
    });
  }

  // Signature-record parity with the confirm page's sign-only path, which
  // records the signature and — because nothing was broadcast — saves no local
  // history. Bookkeeping only: the signed transaction exists and the caller
  // still has to report it, so a failure here must never turn it into a failed
  // payment.
  try {
    const decodedTx = await backgroundApiProxy.serviceSend.buildDecodedTx({
      networkId,
      accountId,
      unsignedTx,
    });
    await backgroundApiProxy.serviceSignature.addItemFromSendProcess(
      { signedTx, decodedTx },
      sourceInfo,
    );
  } catch (error) {
    console.error('wcPay inline solana signature record failed', error);
  }

  return { status: 'ok', rawTx };
}
