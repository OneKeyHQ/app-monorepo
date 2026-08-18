import { resolveSponsorPayerState } from './gasAccountPayerSelection';

const baseParams = {
  serverPayer: 'user' as const,
  megafuelSponsorable: false,
  gasAccountQuoteEligible: false,
  isCustomRpcEnabled: false,
  sponsorDisabledForBatch: false,
  megafuelDisabledForPrivateSend: false,
  gasAccountDisabledByScenario: false,
  gasAccountTemporarilyDisabled: false,
};

describe('resolveSponsorPayerState', () => {
  describe('default flow (no suppression)', () => {
    it('keeps user payer when the server does not sponsor', () => {
      expect(resolveSponsorPayerState(baseParams)).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('selects gas account when the server prefers it and a quote is eligible', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'gasAccount',
        selectedPayer: 'gasAccount',
      });
    });

    it('keeps user submit when megafuel sponsors even if a gas account quote exists', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'megafuel',
        selectedPayer: 'user',
      });
    });

    it('lets megafuel win submit wiring when sponsorable alongside a gasAccount payer', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'gasAccount',
        selectedPayer: 'user',
      });
    });

    it('does not select gas account without an eligible quote', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: false,
        }),
      ).toEqual({
        effectiveFeePayer: 'gasAccount',
        selectedPayer: 'user',
      });
    });
  });

  describe('global suppressions', () => {
    it('forces user for both payers when a custom RPC is enabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: true,
          isCustomRpcEnabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('forces user for both payers on batch transactions', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          sponsorDisabledForBatch: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('forces user when gas account is temporarily disabled after a fallback', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: true,
          gasAccountTemporarilyDisabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('forces user when the frontend scenario disables gas account', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: true,
          gasAccountDisabledByScenario: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('still surfaces megafuel display when only the gas account path is scenario-disabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          gasAccountDisabledByScenario: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'megafuel',
        selectedPayer: 'user',
      });
    });
  });

  describe('private send (megafuel suppressed)', () => {
    it('falls back to the eligible gas account quote when the server prefers megafuel', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          megafuelDisabledForPrivateSend: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'gasAccount',
        selectedPayer: 'gasAccount',
      });
    });

    it('falls back to user when the server prefers megafuel and no quote is eligible', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: false,
          megafuelDisabledForPrivateSend: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('selects gas account when the server prefers it even with megafuel sponsorable', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          megafuelDisabledForPrivateSend: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'gasAccount',
        selectedPayer: 'gasAccount',
      });
    });

    it('keeps user payer when the server does not sponsor', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'user',
          megafuelDisabledForPrivateSend: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('does not fall back to gas account when a custom RPC is enabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          megafuelDisabledForPrivateSend: true,
          isCustomRpcEnabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('does not fall back to gas account while it is temporarily disabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          megafuelDisabledForPrivateSend: true,
          gasAccountTemporarilyDisabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });
  });
});
