import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import type * as PrimeFeatureIntroUtils from './primeFeatureIntroUtils';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: false },
}));

const featureOrder = [
  EPrimeFeatures.TransactionSecurityCheck,
  EPrimeFeatures.BulkSend,
  EPrimeFeatures.ReceiveRiskMonitoring,
  EPrimeFeatures.AddressRiskCheck,
  EPrimeFeatures.BlockaidSiteScan,
  EPrimeFeatures.BulkRevoke,
  EPrimeFeatures.BulkCopyAddresses,
  EPrimeFeatures.HistoryExport,
  EPrimeFeatures.DAppTranslate,
  EPrimeFeatures.Notifications,
];

const browserFeatures = new Set([
  EPrimeFeatures.TransactionSecurityCheck,
  EPrimeFeatures.BlockaidSiteScan,
  EPrimeFeatures.DAppTranslate,
]);

describe.each([
  ['extension popup', true],
  ['extension side panel', true],
  ['extension full screen', true],
  ['desktop', false],
  ['iOS', false],
  ['Android', false],
  ['web', false],
] as const)('Prime benefits on %s', (_platform, isExtension) => {
  let utils: typeof PrimeFeatureIntroUtils;

  beforeEach(() => {
    jest.isolateModules(() => {
      const { default: platformEnv } = jest.requireMock<{
        default: { isExtension: boolean };
      }>('@onekeyhq/shared/src/platformEnv');
      platformEnv.isExtension = isExtension;
      utils = jest.requireActual('./primeFeatureIntroUtils');
    });
  });

  it('preserves all ten benefits in their existing order', () => {
    expect(utils.PRIME_FEATURE_INTROS.map(({ id }) => id)).toEqual(
      featureOrder,
    );
  });

  it('marks only AI translation as app-only, and only on extension', () => {
    expect(
      utils.PRIME_FEATURE_INTROS.filter(({ isAppOnly }) => isAppOnly).map(
        ({ id }) => id,
      ),
    ).toEqual(isExtension ? [EPrimeFeatures.DAppTranslate] : []);
    expect(
      utils.getPrimeFeatureIntro(EPrimeFeatures.DAppTranslate)?.isAppOnly,
    ).toBe(isExtension);
  });

  it('keeps subscription CTAs for every benefit when unsubscribed', () => {
    for (const featureId of featureOrder) {
      expect(
        utils.getPrimeFeatureIntroCtaKind({
          featureId,
          isPrimeSubscriptionActive: false,
        }),
      ).toBe('subscribe');
    }
  });

  it('replaces only extension browser CTAs with status copy when subscribed', () => {
    for (const featureId of featureOrder) {
      let expectedKind = 'featureAction';
      if (isExtension && browserFeatures.has(featureId)) {
        expectedKind =
          featureId === EPrimeFeatures.DAppTranslate
            ? 'availableInApp'
            : 'alwaysOn';
      }
      expect(
        utils.getPrimeFeatureIntroCtaKind({
          featureId,
          isPrimeSubscriptionActive: true,
        }),
      ).toBe(expectedKind);
    }
  });

  it.each([true, false])(
    'has no CTA for a missing feature (subscribed: %s)',
    (isPrimeSubscriptionActive) => {
      expect(
        utils.getPrimeFeatureIntroCtaKind({
          featureId: undefined,
          isPrimeSubscriptionActive,
        }),
      ).toBe('none');
    },
  );
});
