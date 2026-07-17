import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Readable copy for every SDK error code that can surface inline on the buy
// page (quote stage and checkout events). The raw SDK messages are technical
// English and must never reach the user. Placeholder Chinese literals pending
// the i18n pass, same as the rest of the Headless UI. Codes mirror the SDK's
// `OnramperErrorCode` union (1.1.0).
const ERROR_COPY: Record<string, string> = {
  // User-fixable input errors. `quoteUnavailable` (backend 40003) also covers
  // below-minimum amounts — Onramper doesn't expose the limits at quote time,
  // so the copy points at the amount as the actionable lever.
  amountOutOfRange: '金額超出供應商限額，請調整金額',
  quoteUnavailable: '此金額暫無可用報價，可能超出供應商限額，請調整金額後重試',
  // Transient environment errors.
  networkError: '網路連線異常，請檢查網路後重試',
  timeout: '請求逾時，請重試',
  temporaryFailure: '服務暫時不可用，請稍後重試',
  invalidRequest: '暫時無法處理此請求，請稍後重試',
  decodingError: '資料解析失敗，請重試',
  // Stale page / intent state.
  notInitialized: '頁面狀態已過期，請重試',
  initializationFailed: '初始化失敗，請重試',
  invalidState: '頁面狀態已過期，請重試',
  invalidStateTransition: '頁面狀態已過期，請重試',
  intentInvalidated: '報價已過期，請重試',
  intentAlreadyConsumed: '報價已使用，請重新報價',
  requirementNotSatisfied: '尚有未完成的驗證步驟，請重試',
  // Login / session state.
  userTokenInvalid: '登入狀態已過期，請重試',
  userTokenRefreshFailed: '登入狀態已過期，請重試',
  sessionExpirationHandlerFailed: '會話已過期，請重試',
  oidcFlowCancelled: '已取消身分驗證',
  oidcFlowFailed: '身分驗證失敗，請重試',
  oidcTokenExchangeFailed: '身分驗證失敗，請重試',
  // Payment surface.
  webviewLoadFailed: '無法開啟支付頁面，請重試',
  deepLinkFailed: '無法開啟支付頁面，請重試',
  // Device security (retry copy; genuinely blocked devices surface structural
  // codes and go to the web fallback instead).
  securityStorageFailed: '裝置安全檢查未通過，請重試',
  securityTrustFailed: '裝置安全檢查未通過，請重試',
};

const DEFAULT_ERROR_COPY = '暫時無法完成購買，請稍後重試';

function toAmountText(value: unknown): string | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : undefined;
}

export function getOnramperErrorMessage(err: {
  code?: string;
  message?: string;
  info?: Record<string, unknown>;
}): string {
  let copy = (err?.code && ERROR_COPY[err.code]) || DEFAULT_ERROR_COPY;
  // `amountOutOfRange` is validated locally by the SDK and its `info` carries
  // the provider's min/max in the source fiat (per the official docs) — show
  // the real bounds instead of the generic "adjust the amount" copy. The
  // thrown-rejection path loses `info` at the Nitro bridge, so this upgrade
  // only fires on the structured `failed`-event path.
  const min = toAmountText(err?.info?.min);
  const max = toAmountText(err?.info?.max);
  if (min !== undefined && max !== undefined) {
    copy = `請輸入 $${min} – $${max} 之間的金額`;
  } else if (min !== undefined) {
    copy = `最低購買金額為 $${min}，請調整金額`;
  } else if (max !== undefined) {
    copy = `最高購買金額為 $${max}，請調整金額`;
  }
  // Dev builds append the raw code so on-device QA screenshots map back to the
  // SDK error without a log capture.
  return platformEnv.isDev && err?.code ? `${copy} (${err.code})` : copy;
}
