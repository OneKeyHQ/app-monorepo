import { OneKeyLocalError } from '../errors';
import { ETranslations } from '../locale';

/**
 * Error identities of the WalletConnect Pay flow. Every failure the flow
 * raises on purpose carries one of these codes so the UI branches on the
 * code — never on the English message — and renders the matching i18n key.
 * The code travels inside `info` (kept by the background bridge's
 * toPlainErrorObject), so a background-thrown error is recognized on the UI
 * side exactly like a UI-thrown one.
 */
export enum EWcPayErrorCode {
  BroadcastUnsupported = 'broadcastUnsupported',
  ProgressDamaged = 'progressDamaged',
  PaymentExpired = 'paymentExpired',
  CannotCompleteNow = 'cannotCompleteNow',
  TxReverted = 'txReverted',
  TooManyActions = 'tooManyActions',
  SignedTxMismatch = 'signedTxMismatch',
  CannotResumeOnDevice = 'cannotResumeOnDevice',
  TxConfirmationTimeout = 'txConfirmationTimeout',
  EmptyRpcResponse = 'emptyRpcResponse',
  DataCollectionUnavailable = 'dataCollectionUnavailable',
  DataCollectionUntrusted = 'dataCollectionUntrusted',
  AccountTypeUnsupported = 'accountTypeUnsupported',
  // Defensive verdicts: malformed server data or API misuse. They keep their
  // own identity for logs and tests but read as the generic failure on
  // screen — a user cannot act on "unsupported chain".
  NotAvailable = 'notAvailable',
  InvalidPaymentLink = 'invalidPaymentLink',
  NoSupportedNetworks = 'noSupportedNetworks',
  InvalidActionParams = 'invalidActionParams',
  UnsupportedChain = 'unsupportedChain',
  UnsupportedMethod = 'unsupportedMethod',
  MethodChainMismatch = 'methodChainMismatch',
  MissingTxid = 'missingTxid',
  MissingSignedTx = 'missingSignedTx',
  InvalidSolanaPayload = 'invalidSolanaPayload',
}

export const WC_PAY_ERROR_I18N_KEYS: Record<EWcPayErrorCode, ETranslations> = {
  [EWcPayErrorCode.BroadcastUnsupported]:
    ETranslations.wc_pay_onchain_unsupported_platform__msg,
  [EWcPayErrorCode.ProgressDamaged]:
    ETranslations.wc_pay_progress_damaged__desc,
  [EWcPayErrorCode.PaymentExpired]:
    ETranslations.wc_pay_payment_no_longer_payable__desc,
  [EWcPayErrorCode.CannotCompleteNow]:
    ETranslations.wc_pay_cannot_complete_now__msg,
  [EWcPayErrorCode.TxReverted]: ETranslations.wc_pay_tx_reverted__msg,
  [EWcPayErrorCode.TooManyActions]: ETranslations.wc_pay_too_many_actions__msg,
  [EWcPayErrorCode.SignedTxMismatch]:
    ETranslations.wc_pay_signed_tx_mismatch__msg,
  [EWcPayErrorCode.CannotResumeOnDevice]:
    ETranslations.wc_pay_cannot_resume_on_device__msg,
  [EWcPayErrorCode.TxConfirmationTimeout]:
    ETranslations.wc_pay_tx_confirmation_timeout__msg,
  [EWcPayErrorCode.EmptyRpcResponse]:
    ETranslations.wc_pay_empty_rpc_response__msg,
  [EWcPayErrorCode.DataCollectionUnavailable]:
    ETranslations.wc_pay_data_collection_unavailable__msg,
  [EWcPayErrorCode.DataCollectionUntrusted]:
    ETranslations.wc_pay_data_collection_untrusted__msg,
  [EWcPayErrorCode.AccountTypeUnsupported]:
    ETranslations.wc_pay_account_type_unsupported__msg,
  [EWcPayErrorCode.NotAvailable]: ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.InvalidPaymentLink]:
    ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.NoSupportedNetworks]:
    ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.InvalidActionParams]:
    ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.UnsupportedChain]: ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.UnsupportedMethod]:
    ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.MethodChainMismatch]:
    ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.MissingTxid]: ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.MissingSignedTx]: ETranslations.wc_pay_generic_failure__msg,
  [EWcPayErrorCode.InvalidSolanaPayload]:
    ETranslations.wc_pay_generic_failure__msg,
};

export interface IWcPayErrorInfo {
  wcPayCode: EWcPayErrorCode;
}

/**
 * The one error class of the flow. `message` stays English for logs and
 * tests; `key` is what the UI renders; the code inside `info` is the
 * identity control flow branches on. A local error on purpose: these are
 * deterministic business verdicts, not crashes worth a Sentry event.
 */
export class WcPayError extends OneKeyLocalError<IWcPayErrorInfo> {
  constructor({ code, message }: { code: EWcPayErrorCode; message: string }) {
    super({
      message,
      key: WC_PAY_ERROR_I18N_KEYS[code],
      info: { wcPayCode: code },
    });
  }
}

const WC_PAY_ERROR_CODES = new Set<string>(Object.values(EWcPayErrorCode));

/**
 * Reads the code off an error of any shape — a live WcPayError instance or
 * the plain object a background rejection arrives as. Undefined for
 * everything that is not a WalletConnect Pay verdict.
 */
export function getWcPayErrorCode(error: unknown): EWcPayErrorCode | undefined {
  const code = (error as { info?: { wcPayCode?: unknown } } | undefined)?.info
    ?.wcPayCode;
  return typeof code === 'string' && WC_PAY_ERROR_CODES.has(code)
    ? (code as EWcPayErrorCode)
    : undefined;
}

export function isWcPayErrorCode(
  error: unknown,
  code: EWcPayErrorCode,
): boolean {
  return getWcPayErrorCode(error) === code;
}
