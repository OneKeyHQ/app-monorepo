/*
yarn jest packages/kit/src/views/SignatureConfirm/utils/gasAccountAnalytics.skipReason.test.ts

OK-64746 phase 1 observability: the backend's `gasAccountSkipReason` (open
string, e.g. member_required / member_pending / eligibility_unavailable) and
the quote owner type (`gasAccountQuote.identity.ownerType`, 'member' when the
quote is bound to a OneKey ID member) must reach the gas-account analytics
events so the member rollout can be observed from logs.
*/
import {
  buildGasAccountAnalyticsContext,
  getBackendGasAccountUnavailableReason,
} from './gasAccountAnalytics';

const baseParams = {
  entryPoint: 'txConfirm' as const,
  network: 'evm--42161',
  scenario: 'send' as const,
  gasAccountRequested: true,
  gasAccountSupported: null,
  gasAccountEligible: false,
  selectedPayer: 'user' as const,
  effectiveFeePayer: 'user' as const,
  unavailableReason: 'member_required',
  estimatedGasNative: '0.01',
  nativeBalance: '1',
  nativePrincipal: '0',
  extraFeeNative: '0',
  nativeTokenPrice: '2000',
  fiatCurrency: 'usd',
  tokenPrincipalInsufficient: false,
  quoteId: undefined,
};

describe('gas account analytics member-dimension fields', () => {
  it('carries the backend skip reason and quote owner type', () => {
    const result = buildGasAccountAnalyticsContext({
      ...baseParams,
      gasAccountSkipReason: 'member_required',
      quoteOwnerType: 'member',
    });

    expect(result.gasAccountSkipReason).toBe('member_required');
    expect(result.quoteOwnerType).toBe('member');
  });

  it('reports both fields as undefined when the backend sends neither', () => {
    const result = buildGasAccountAnalyticsContext(baseParams);

    expect(result.gasAccountSkipReason).toBeUndefined();
    expect(result.quoteOwnerType).toBeUndefined();
  });
});

describe('getBackendGasAccountUnavailableReason', () => {
  it('prefers the scenario gate reason over the skip reason', () => {
    expect(
      getBackendGasAccountUnavailableReason({
        gasAccountScenarioReason: 'scenario_disabled_send',
        gasAccountSkipReason: 'member_required',
      }),
    ).toBe('scenario_disabled_send');
  });

  it('falls back to the skip reason when no scenario gate applies', () => {
    expect(
      getBackendGasAccountUnavailableReason({
        gasAccountScenarioReason: undefined,
        gasAccountSkipReason: 'member_pending',
      }),
    ).toBe('member_pending');
  });

  it('reports backend_unknown when the backend gives no reason', () => {
    expect(
      getBackendGasAccountUnavailableReason({
        gasAccountScenarioReason: undefined,
        gasAccountSkipReason: undefined,
      }),
    ).toBe('backend_unknown');
  });
});
