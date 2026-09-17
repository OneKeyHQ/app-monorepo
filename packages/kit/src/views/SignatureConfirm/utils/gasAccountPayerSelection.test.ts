import {
  isGasAccountQuoteEligible,
  resolveSponsorPayerState,
} from './gasAccountPayerSelection';

const baseParams = {
  serverPayer: 'user' as const,
  megafuelSponsorable: false,
  gasAccountQuoteEligible: false,
  isCustomRpcEnabled: false,
  sponsorDisabledForBatch: false,
  sponsorDisabledForExternalAccount: false,
  gasAccountDisabledByScenario: false,
  gasAccountTemporarilyDisabled: false,
};

describe('isGasAccountQuoteEligible', () => {
  const quote = {
    quoteId: 'quote-1',
    maxFee: '1000',
    expiresAt: '2026-01-01T00:00:00Z',
  };

  it('is eligible only with both the eligible flag and a non-empty quoteId', () => {
    expect(
      isGasAccountQuoteEligible({
        gasAccountEligible: true,
        gasAccountQuote: quote,
      }),
    ).toBe(true);
  });

  it('rejects a quote object whose quoteId is empty', () => {
    expect(
      isGasAccountQuoteEligible({
        gasAccountEligible: true,
        gasAccountQuote: { ...quote, quoteId: '' },
      }),
    ).toBe(false);
  });

  it('rejects a missing quote or a missing eligible flag', () => {
    expect(
      isGasAccountQuoteEligible({
        gasAccountEligible: true,
        gasAccountQuote: undefined,
      }),
    ).toBe(false);
    expect(
      isGasAccountQuoteEligible({
        gasAccountEligible: undefined,
        gasAccountQuote: quote,
      }),
    ).toBe(false);
    expect(
      isGasAccountQuoteEligible({
        gasAccountEligible: false,
        gasAccountQuote: quote,
      }),
    ).toBe(false);
  });

  it('never wires the gas account submit path on an id-less quote', () => {
    // End-to-end invariant: an id-less quote must never wire the submit path
    // (selectedPayer) to gasAccount; megafuel display stays intact since it
    // does not depend on the quote.
    expect(
      resolveSponsorPayerState({
        ...baseParams,
        serverPayer: 'megafuel',
        megafuelSponsorable: true,
        gasAccountQuoteEligible: isGasAccountQuoteEligible({
          gasAccountEligible: true,
          gasAccountQuote: { ...quote, quoteId: '' },
        }),
      }),
    ).toEqual({
      effectiveFeePayer: 'megafuel',
      selectedPayer: 'user',
    });
  });

  it('resolves to user/user when the server prefers gasAccount but the quoteId is empty', () => {
    // Same invariant on the direct serverPayer === 'gasAccount' path: with no
    // suppression flags set, only quote eligibility stands between an id-less
    // quote and the sponsored display state.
    expect(
      resolveSponsorPayerState({
        ...baseParams,
        serverPayer: 'gasAccount',
        gasAccountQuoteEligible: isGasAccountQuoteEligible({
          gasAccountEligible: true,
          gasAccountQuote: { ...quote, quoteId: '' },
        }),
      }),
    ).toEqual({
      effectiveFeePayer: 'user',
      selectedPayer: 'user',
    });
  });
});

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

    it('surfaces megafuel without an eligible gas account quote', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: false,
        }),
      ).toEqual({
        effectiveFeePayer: 'megafuel',
        selectedPayer: 'user',
      });
    });

    it('resets both payers to user without an eligible quote', () => {
      // The display payer must be gated by quote eligibility as well:
      // keeping effectiveFeePayer at 'gasAccount' here would show the
      // sponsored UI while the submit path broadcasts user-paid.
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: false,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
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

    it('forces user for both payers for external-wallet accounts (OK-61254)', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          sponsorDisabledForExternalAccount: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });

    it('forces user for external-wallet accounts when the server prefers gasAccount', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'gasAccount',
          gasAccountQuoteEligible: true,
          sponsorDisabledForExternalAccount: true,
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

    it('still surfaces megafuel while gas account is temporarily disabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          gasAccountTemporarilyDisabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'megafuel',
        selectedPayer: 'user',
      });
    });

    it('forces user for megafuel when a custom RPC is enabled', () => {
      expect(
        resolveSponsorPayerState({
          ...baseParams,
          serverPayer: 'megafuel',
          megafuelSponsorable: true,
          gasAccountQuoteEligible: true,
          isCustomRpcEnabled: true,
        }),
      ).toEqual({
        effectiveFeePayer: 'user',
        selectedPayer: 'user',
      });
    });
  });
});
