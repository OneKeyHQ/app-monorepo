import {
  buildGasAccountAnalyticsContext,
  isGasSponsoredAnalyticsContext,
} from './gasAccountAnalytics';

const baseParams = {
  entryPoint: 'txConfirm' as const,
  network: 'evm--1',
  scenario: 'send' as const,
  gasAccountRequested: true,
  gasAccountSupported: true,
  gasAccountEligible: true,
  selectedPayer: 'gasAccount' as const,
  effectiveFeePayer: 'gasAccount' as const,
  unavailableReason: undefined,
  estimatedGasNative: '0.01',
  nativeBalance: '0.105',
  nativePrincipal: '0.1',
  extraFeeNative: '0',
  nativeTokenPrice: '2000',
  fiatCurrency: 'usd',
  tokenPrincipalInsufficient: false,
  quoteId: 'quote-id',
};

describe('buildGasAccountAnalyticsContext', () => {
  it('classifies a same-native-token transfer as a network fee shortage', () => {
    const result = buildGasAccountAnalyticsContext(baseParams);

    expect(result.shortageType).toBe('networkFee');
    expect(result.gasShortfallNative).toBe('0.005');
    expect(result.gasShortfallFiat).toBe('10');
    expect(result.gasShortfallFiatBucket).toBe('gte_5');
    expect(result.selfPayGasSufficient).toBe(false);
  });

  it('uses the first blocking cause for a same-native-token shortage', () => {
    const result = buildGasAccountAnalyticsContext({
      ...baseParams,
      nativeBalance: '0.09',
    });

    expect(result.shortageType).toBe('principal');
  });

  it('uses mixed only when token principal and native gas are both short', () => {
    const result = buildGasAccountAnalyticsContext({
      ...baseParams,
      nativePrincipal: '0',
      nativeBalance: '0.005',
      tokenPrincipalInsufficient: true,
    });

    expect(result.shortageType).toBe('mixed');
  });

  it('marks fiat fields unavailable when the native token has no price', () => {
    const result = buildGasAccountAnalyticsContext({
      ...baseParams,
      nativeTokenPrice: undefined,
    });

    expect(result.fiatValueAvailable).toBe(false);
    expect(result.estimatedGasFiat).toBeUndefined();
    expect(result.gasShortfallFiat).toBeUndefined();
    expect(result.gasShortfallFiatBucket).toBe('unknown');
    expect(result.nativeBalanceFiatBucket).toBe('unknown');
  });

  it('keeps balance-dependent fields unknown when balance is unavailable', () => {
    const result = buildGasAccountAnalyticsContext({
      ...baseParams,
      nativeBalance: undefined,
    });

    expect(result.nativeBalanceAvailable).toBe(false);
    expect(result.selfPayGasSufficient).toBeNull();
    expect(result.shortageType).toBe('unknown');
    expect(result.gasShortfallNative).toBeUndefined();
  });

  it('treats MegaFuel as a sponsored fee payer for action telemetry', () => {
    expect(
      isGasSponsoredAnalyticsContext({
        ...buildGasAccountAnalyticsContext(baseParams),
        selectedPayer: 'user',
        effectiveFeePayer: 'megafuel',
        gasAccountEligible: false,
      }),
    ).toBe(true);
  });

  it('does not treat eligibility or a gas shortage alone as sponsorship', () => {
    expect(
      isGasSponsoredAnalyticsContext({
        ...buildGasAccountAnalyticsContext(baseParams),
        selectedPayer: 'user',
        effectiveFeePayer: 'user',
        gasAccountEligible: true,
        shortageType: 'networkFee',
      }),
    ).toBe(false);
  });
});
