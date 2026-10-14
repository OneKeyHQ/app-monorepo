import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  formatPrimeFreeTrialReservationEnd,
  formatPrimeFreeTrialResetDate,
} from '@onekeyhq/shared/src/utils/primeFreeTrialUtils';
import type {
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialUnit,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

// Free-trial copy is hard-coded Chinese for now (no i18n keys yet). Keep every
// string here so the later i18n migration only has to replace this file.

// Feature names, written once: every toast title is "<feature>：<status>".
const FEATURE_NAME: Record<IPrimeFreeTrialFeatureId, string> = {
  [EPrimeFeatures.BulkCopyAddresses]: '批量复制地址',
  [EPrimeFeatures.BulkSend]: '批量转账',
  [EPrimeFeatures.BulkRevoke]: '批量取消授权',
  [EPrimeFeatures.AddressRiskCheck]: '地址风险检查',
  [EPrimeFeatures.DAppTranslate]: 'AI 翻译',
};

// Translate is metered in tokens, every other feature in uses.
const QUOTA_EXHAUSTED: Record<IPrimeFreeTrialUnit, string> = {
  count: '本月免费次数已用完',
  token: '本月免费额度已用完',
};

// A state the free trial rejects a feature in. The remaining hint and the
// toasts both read its text from getPrimeFreeTrialNoticeCopy, so they cannot
// drift apart.
export type IPrimeFreeTrialNotice =
  | { kind: 'exhausted'; resetAt?: number }
  // Used up only by live reservations of earlier uses (still running or
  // interrupted, on any device).
  | { kind: 'reservationHeld'; heldUntil: number }
  | { kind: 'notOpen' }
  // Toast only: the details of an address not checked this month; the
  // feature itself is open.
  | { kind: 'detailsNotEligible' }
  // Toast only: translate closed while a session was running.
  | { kind: 'noLongerAvailable' };

// What happened, and an optional detail (when it ends).
function getNoticeParts(
  featureId: IPrimeFreeTrialFeatureId,
  notice: IPrimeFreeTrialNotice,
): { status: string; detail?: string } {
  switch (notice.kind) {
    case 'exhausted': {
      const date = formatPrimeFreeTrialResetDate(notice.resetAt);
      return {
        status:
          QUOTA_EXHAUSTED[
            featureId === EPrimeFeatures.DAppTranslate ? 'token' : 'count'
          ],
        detail: date ? `将于 ${date} 重置` : undefined,
      };
    }
    case 'reservationHeld': {
      const time = formatPrimeFreeTrialReservationEnd(notice.heldUntil);
      return {
        status: '上次使用尚未结束',
        // The uses come back only if that use did not succeed.
        detail: time ? `如已中断，免费次数将在 ${time} 前恢复` : undefined,
      };
    }
    case 'notOpen':
      return { status: '暂未开放免费体验' };
    case 'detailsNotEligible':
      return { status: '本月检查过的地址才能查看详情' };
    case 'noLongerAvailable':
      return { status: '免费体验已不再提供' };
    default:
      return notice satisfies never;
  }
}

// The single source of the rejection copy:
// - toast title: "<feature>：<status>"
// - toast body: the detail as a sentence
// - remaining hint (the page already names the feature): the title without
//   the feature name, then the detail, in one line
export function getPrimeFreeTrialNoticeCopy({
  featureId,
  notice,
}: {
  featureId: IPrimeFreeTrialFeatureId;
  notice: IPrimeFreeTrialNotice;
}) {
  const { status, detail } = getNoticeParts(featureId, notice);
  return {
    toastTitle: `${FEATURE_NAME[featureId]}：${status}`,
    toastMessage: detail ? `${detail}。` : undefined,
    hint: detail ? `${status}，${detail}` : status,
  };
}

export const PRIME_FREE_TRIAL_COPY = {
  // Remaining hint while uses are left.
  remainingUses(count: number) {
    return `本月还可免费使用 ${count} 次`;
  },
  // Translate is metered in tokens: the hint shows the remaining share.
  remainingQuotaPercent(percent: number) {
    return `本月免费额度剩余 ${percent}%`;
  },
  // Address risk check result reopened from the local history.
  addressRiskCheckHistoryResult: '当前为历史检查结果，风险状况可能已有变化。',
  getPrime: '获取 Prime',
};
