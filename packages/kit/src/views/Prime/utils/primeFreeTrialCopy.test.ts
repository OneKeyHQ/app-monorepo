import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import zhCatalog from '@onekeyhq/shared/src/locale/json/zh_CN.json';
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
      [EPrimeFeatures.BulkRevoke, '批量取消'],
      [EPrimeFeatures.AddressRiskCheck, '地址风险检查'],
    ] as const
  ).flatMap(([featureId, name]) => [
    {
      featureId,
      notice: { kind: 'exhausted', resetAt: RESET_AT } as const,
      toastTitle: `${name}本月免费次数已用完`,
      toastMessage: '2026-11-01 重置',
      hint: '本月免费次数已用完。2026-11-01 重置',
    },
    {
      featureId,
      notice: { kind: 'notOpen' } as const,
      toastTitle: `${name}暂未开放免费体验`,
      hint: '暂未开放免费体验',
    },
  ]),
  ...(
    [
      [EPrimeFeatures.BulkCopyAddresses, '批量复制地址'],
      [EPrimeFeatures.BulkSend, '批量转账'],
      [EPrimeFeatures.BulkRevoke, '批量取消'],
    ] as const
  ).map(([featureId, name]) => ({
    featureId,
    notice: { kind: 'reservationHeld', heldUntil: HELD_UNTIL } as const,
    toastTitle: `${name}上次使用未结束`,
    toastMessage: '若已中断，下午 6:41 前退回次数',
    hint: '上次使用未结束。若已中断，下午 6:41 前退回次数',
  })),
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'exhausted', resetAt: RESET_AT },
    toastTitle: 'AI 翻译本月免费额度已用完',
    toastMessage: '2026-11-01 重置',
    // Translate renders no hint.
    hint: '本月免费次数已用完。2026-11-01 重置',
  },
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'notOpen' },
    toastTitle: 'AI 翻译暂未开放免费体验',
    hint: '暂未开放免费体验',
  },
  {
    featureId: EPrimeFeatures.DAppTranslate,
    notice: { kind: 'noLongerAvailable' },
    toastTitle: 'AI 翻译免费体验已结束',
    hint: 'AI 翻译免费体验已结束',
  },
  {
    featureId: EPrimeFeatures.AddressRiskCheck,
    notice: { kind: 'detailsNotEligible' },
    toastTitle: '仅可查看本月检查过的地址详情',
    hint: '仅可查看本月检查过的地址详情',
  },
];

const FEATURE_NAMES: Record<IPrimeFreeTrialFeatureId, string> = {
  [EPrimeFeatures.BulkCopyAddresses]: '批量复制地址',
  [EPrimeFeatures.BulkSend]: '批量转账',
  [EPrimeFeatures.BulkRevoke]: '批量取消',
  [EPrimeFeatures.AddressRiskCheck]: '地址风险检查',
  [EPrimeFeatures.DAppTranslate]: 'AI 翻译',
};

describe('getPrimeFreeTrialNoticeCopy', () => {
  beforeAll(() => {
    appLocale.setLocale(
      'zh-CN',
      zhCatalog as Parameters<typeof appLocale.setLocale>[1],
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
      expect(
        getPrimeFreeTrialNoticeCopy({
          intl: appLocale.intl,
          featureId,
          notice,
        }),
      ).toEqual({
        toastTitle,
        toastMessage,
        hint,
      });
    },
  );

  // The hint and the toast never drift apart: on pages with a hint, the hint
  // opens with the toast title's status (the title without the feature name).
  it.each(
    CASES.filter(
      ({ featureId, notice }) =>
        featureId !== EPrimeFeatures.DAppTranslate &&
        notice.kind !== 'detailsNotEligible',
    ),
  )(
    'keeps the hint of $featureId $notice.kind in line with its toast',
    ({ featureId, notice }) => {
      const copy = getPrimeFreeTrialNoticeCopy({
        intl: appLocale.intl,
        featureId,
        notice,
      });
      const status = copy.toastTitle.slice(FEATURE_NAMES[featureId].length);
      expect(copy.hint.startsWith(status)).toBe(true);
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
          intl: appLocale.intl,
          featureId: EPrimeFeatures.BulkSend,
          notice: { kind },
        }).toastMessage,
      ).toBeUndefined();
    }
    // A used-up quota without a known reset time has no body either.
    expect(
      getPrimeFreeTrialNoticeCopy({
        intl: appLocale.intl,
        featureId: EPrimeFeatures.BulkSend,
        notice: { kind: 'exhausted' },
      }),
    ).toEqual({
      toastTitle: '批量转账本月免费次数已用完',
      toastMessage: undefined,
      hint: '本月免费次数已用完',
    });
  });
});
