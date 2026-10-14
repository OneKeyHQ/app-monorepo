import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IPrimeFreeTrialFeatureId } from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import { getPrimeFreeTrialNoticeCopy } from './primeFreeTrialCopy';

import type { IPrimeFreeTrialNotice } from './primeFreeTrialCopy';

// Built from local components so the output does not depend on the time zone.
const RESET_AT = new Date(2026, 10, 1, 8, 0).getTime();
const HELD_UNTIL = new Date(2026, 9, 13, 18, 41).getTime();

// Every notice the app can show, with the copy it gets (zh-CN).
const CASES: Array<{
  featureId: IPrimeFreeTrialFeatureId;
  notice: IPrimeFreeTrialNotice;
  toastTitle: string;
  toastMessage?: string;
  hint: string;
}> = [
  ...(
    [
      [EPrimeFeatures.BulkCopyAddresses, '批量复制地址'],
      [EPrimeFeatures.BulkSend, '批量转账'],
      [EPrimeFeatures.BulkRevoke, '批量取消授权'],
      [EPrimeFeatures.AddressRiskCheck, '地址风险检查'],
    ] as const
  ).flatMap(([featureId, name]) => [
    {
      featureId,
      notice: { kind: 'exhausted', resetAt: RESET_AT } as const,
      toastTitle: `${name}：本月免费次数已用完`,
      toastMessage: '将于 2026-11-01 上午 8:00 重置。',
      hint: '本月免费次数已用完，将于 2026-11-01 上午 8:00 重置',
    },
    {
      featureId,
      notice: { kind: 'notOpen' } as const,
      toastTitle: `${name}：暂未开放免费体验`,
      hint: '暂未开放免费体验',
    },
  ]),
  ...(
    [
      [EPrimeFeatures.BulkCopyAddresses, '批量复制地址'],
      [EPrimeFeatures.BulkSend, '批量转账'],
      [EPrimeFeatures.BulkRevoke, '批量取消授权'],
    ] as const
  ).map(([featureId, name]) => ({
    featureId,
    notice: { kind: 'reservationHeld', heldUntil: HELD_UNTIL } as const,
    toastTitle: `${name}：上次使用尚未结束`,
    toastMessage: '如已中断，免费次数将在 下午 6:41 前恢复。',
    hint: '上次使用尚未结束，如已中断，免费次数将在 下午 6:41 前恢复',
  })),
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'exhausted', resetAt: RESET_AT },
    toastTitle: 'AI 翻译：本月免费额度已用完',
    toastMessage: '将于 2026-11-01 上午 8:00 重置。',
    hint: '本月免费额度已用完，将于 2026-11-01 上午 8:00 重置',
  },
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'notOpen' },
    toastTitle: 'AI 翻译：暂未开放免费体验',
    hint: '暂未开放免费体验',
  },
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'noLongerAvailable' },
    toastTitle: 'AI 翻译：免费体验已不再提供',
    hint: '免费体验已不再提供',
  },
  {
    featureId: EPrimeFeatures.AddressRiskCheck,
    notice: { kind: 'detailsNotEligible' },
    toastTitle: '地址风险检查：本月检查过的地址才能查看详情',
    hint: '本月检查过的地址才能查看详情',
  },
];

describe('getPrimeFreeTrialNoticeCopy', () => {
  beforeAll(() => {
    appLocale.setLocale(
      'zh-CN',
      {} as Parameters<typeof appLocale.setLocale>[1],
    );
  });

  afterAll(() => {
    appLocale.setLocale(
      'en-US',
      {} as Parameters<typeof appLocale.setLocale>[1],
    );
  });

  it.each(CASES)(
    '$featureId $notice.kind',
    ({ featureId, notice, toastTitle, toastMessage, hint }) => {
      expect(getPrimeFreeTrialNoticeCopy({ featureId, notice })).toEqual({
        toastTitle,
        toastMessage,
        hint,
      });
    },
  );

  // The hint and the toast never drift apart: the hint is the toast title
  // without the feature name, then the toast body, in one line.
  it.each(CASES)(
    'keeps the hint of $featureId $notice.kind in line with its toast',
    ({ featureId, notice }) => {
      const copy = getPrimeFreeTrialNoticeCopy({ featureId, notice });
      const status = copy.toastTitle.slice(copy.toastTitle.indexOf('：') + 1);
      expect(copy.hint).toBe(
        copy.toastMessage
          ? `${status}，${copy.toastMessage.replace(/。$/, '')}`
          : status,
      );
    },
  );

  it('gives no reset date to anything but a used-up quota', () => {
    for (const kind of [
      'notOpen',
      'detailsNotEligible',
      'noLongerAvailable',
    ] as const) {
      expect(
        getPrimeFreeTrialNoticeCopy({
          featureId: EPrimeFeatures.BulkSend,
          notice: { kind },
        }).toastMessage,
      ).toBeUndefined();
    }
    // A used-up quota without a known reset time has no body either.
    expect(
      getPrimeFreeTrialNoticeCopy({
        featureId: EPrimeFeatures.BulkSend,
        notice: { kind: 'exhausted' },
      }),
    ).toEqual({
      toastTitle: '批量转账：本月免费次数已用完',
      toastMessage: undefined,
      hint: '本月免费次数已用完',
    });
  });
});
