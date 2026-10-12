import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialFeatureId,
  IPrimeFreeTrialUnit,
  IPrimeFreeTrialUsageFeatureId,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

// Free-trial copy is hard-coded Chinese for now (no i18n keys yet). Keep every
// string here so the later i18n migration only has to replace this file.
// Each feature has its own complete sentence (no feature-name interpolation)
// so each one maps to a single translation key later; the exhausted titles
// share the quota sentence with the remaining-uses hint.

// The remaining hint at 0 shows it alone (the page already names the
// feature); the exhausted toast prefixes the feature name.
const QUOTA_EXHAUSTED = '本月免费次数已用完';

export const PRIME_FREE_TRIAL_COPY = {
  remainingUses(count: number) {
    return `本月还可免费使用 ${count} 次`;
  },
  // Translate is metered in tokens: the hint shows the remaining share.
  remainingQuotaPercent(percent: number) {
    return `本月免费额度剩余 ${percent}%`;
  },
  quotaExhausted: {
    count: QUOTA_EXHAUSTED,
    token: '本月免费额度已用完',
  } satisfies Record<IPrimeFreeTrialUnit, string>,
  exhaustedTitle: {
    [EPrimeFeatures.BulkCopyAddresses]: `批量复制地址：${QUOTA_EXHAUSTED}`,
    [EPrimeFeatures.BulkSend]: `批量转账：${QUOTA_EXHAUSTED}`,
    [EPrimeFeatures.BulkRevoke]: `批量取消授权：${QUOTA_EXHAUSTED}`,
    [EPrimeFeatures.AddressRiskCheck]: `地址风险检查：${QUOTA_EXHAUSTED}`,
    [EPrimeFeatures.DAppTranslate]: '本月 AI 翻译免费额度已用完',
  } satisfies Record<IPrimeFreeTrialFeatureId, string>,
  resetsOn(date: string) {
    return `将于 ${date} 重置。`;
  },
  // The quota is only held by a reservation of an earlier use (still running
  // or interrupted), not used up.
  reservationHeldTitle: {
    [EPrimeFeatures.BulkCopyAddresses]: '批量复制地址：上次使用尚未结束',
    [EPrimeFeatures.BulkSend]: '批量转账：上次使用尚未结束',
    [EPrimeFeatures.BulkRevoke]: '批量取消授权：上次使用尚未结束',
  } satisfies Record<IPrimeFreeTrialUsageFeatureId, string>,
  reservationHeldMessage(time: string) {
    return `如果上次使用已中断，免费次数将在 ${time} 前恢复。`;
  },
  translateNoLongerAvailableTitle: 'AI 翻译免费试用已不再提供',
  // Address risk check result reopened from the local history.
  addressRiskCheckHistoryResult: '当前为历史检查结果，风险状况可能已有变化。',
  getPrime: '获取 Prime',
};
