import { ESwapProviderSort } from '../../types/swap/SwapProvider.constants';

import { selectBestQuote, sortSwapQuotes } from './swapQuoteSortUtils';

import type { IFetchQuoteResult } from '../../types/swap/types';

// ---------------------------------------------------------------------------
// helpers – minimal IFetchQuoteResult factories
// ---------------------------------------------------------------------------
function makeQuote(
  overrides: Partial<IFetchQuoteResult> & { quoteId: string },
): IFetchQuoteResult {
  return {
    info: { provider: 'test', providerName: 'Test' },
    fromTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
    },
    toTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      decimals: 6,
    },
    isBest: false,
    receivedBest: false,
    minGasCost: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const quoteA = makeQuote({
  quoteId: 'A',
  toAmount: '100',
  fee: { percentageFee: 0, estimatedFeeFiatValue: 5 },
  estimatedTime: '30',
});

const quoteB = makeQuote({
  quoteId: 'B',
  toAmount: '90',
  fee: { percentageFee: 0, estimatedFeeFiatValue: 2 },
  estimatedTime: '60',
});

const quoteC = makeQuote({
  quoteId: 'C',
  toAmount: '110',
  fee: { percentageFee: 0, estimatedFeeFiatValue: 8 },
  estimatedTime: '10',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sortSwapQuotes', () => {
  // -------------------------------------------------------------------------
  // Empty list
  // -------------------------------------------------------------------------
  it('returns empty array for empty input', () => {
    expect(sortSwapQuotes([])).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Purity check
  // -------------------------------------------------------------------------
  it('does NOT mutate the input array or its objects', () => {
    const input = [quoteA, quoteB, quoteC];
    const frozenInput = Object.freeze([...input]);
    // Objects should also not be mutated
    const origA = { ...quoteA };
    sortSwapQuotes(frozenInput as IFetchQuoteResult[], {
      sort: ESwapProviderSort.RECOMMENDED,
    });
    // Original quoteA must still have the same fields
    expect(quoteA).toEqual(origA);
    // Input array length unchanged
    expect(frozenInput.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Default sort is RECOMMENDED
  // -------------------------------------------------------------------------
  it('defaults to RECOMMENDED sort when no sort option is provided', () => {
    const result1 = sortSwapQuotes([quoteA, quoteB, quoteC]);
    const result2 = sortSwapQuotes([quoteA, quoteB, quoteC], {
      sort: ESwapProviderSort.RECOMMENDED,
    });
    expect(result1.map((q) => q.quoteId)).toEqual(
      result2.map((q) => q.quoteId),
    );
  });

  // -------------------------------------------------------------------------
  // GAS_FEE sort
  // -------------------------------------------------------------------------
  describe('GAS_FEE sort', () => {
    it('sorts by estimatedFeeFiatValue ascending', () => {
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.GAS_FEE,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['B', 'A', 'C']);
    });

    it('treats missing fee as Infinity (pushed to end)', () => {
      const noFee = makeQuote({ quoteId: 'NO_FEE', toAmount: '200' });
      const result = sortSwapQuotes([noFee, quoteB], {
        sort: ESwapProviderSort.GAS_FEE,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['B', 'NO_FEE']);
    });

    it('treats fee value 0 as Infinity (|| fallback, matches App atoms.ts)', () => {
      const zeroFee = makeQuote({
        quoteId: 'ZERO_FEE',
        toAmount: '200',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 0 },
      });
      const result = sortSwapQuotes([zeroFee, quoteB], {
        sort: ESwapProviderSort.GAS_FEE,
        fromTokenAmount: '50',
      });
      // 0 is falsy → || Infinity → pushed to end, matching App behavior
      expect(result.map((q) => q.quoteId)).toEqual(['B', 'ZERO_FEE']);
    });
  });

  // -------------------------------------------------------------------------
  // SWAP_DURATION sort
  // -------------------------------------------------------------------------
  describe('SWAP_DURATION sort', () => {
    it('sorts by estimatedTime ascending', () => {
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.SWAP_DURATION,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['C', 'A', 'B']);
    });

    it('treats missing estimatedTime as Infinity', () => {
      const noTime = makeQuote({ quoteId: 'NO_TIME', toAmount: '50' });
      const result = sortSwapQuotes([noTime, quoteC], {
        sort: ESwapProviderSort.SWAP_DURATION,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['C', 'NO_TIME']);
    });
  });

  // -------------------------------------------------------------------------
  // RECEIVED sort (uses slippage)
  // -------------------------------------------------------------------------
  describe('RECEIVED sort', () => {
    it('sorts by toAmount * (toAmountSlippage + 1) descending', () => {
      // A: 100 * 1 = 100, C: 110 * 1 = 110, B: 90 * 1 = 90
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['C', 'A', 'B']);
    });

    it('factors in toAmountSlippage', () => {
      // With slippage=-0.1 for C: 110 * (1 + (-0.1)) = 110*0.9 = 99
      // A: 100 * 1 = 100
      const cWithSlippage = makeQuote({
        quoteId: 'C_SLIP',
        toAmount: '110',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 8 },
        estimatedTime: '10',
        toAmountSlippage: -0.1,
      });
      const result = sortSwapQuotes([quoteA, cWithSlippage], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '50',
      });
      // A: 100, C_SLIP: 99 → A comes first
      expect(result.map((q) => q.quoteId)).toEqual(['A', 'C_SLIP']);
    });

    it('pushes zero-toAmount quotes down', () => {
      const zeroAmount = makeQuote({ quoteId: 'ZERO', toAmount: '0' });
      const result = sortSwapQuotes([zeroAmount, quoteB], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '50',
      });
      expect(result.map((q) => q.quoteId)).toEqual(['B', 'ZERO']);
    });
  });

  // -------------------------------------------------------------------------
  // RECOMMENDED sort – approved weight boost
  // -------------------------------------------------------------------------
  describe('RECOMMENDED sort – approved weight boost', () => {
    it('elevates pre-approved provider when within 10% of best (1.1× boost)', () => {
      // Best by received: unapproved with toAmount=100 (needs allowance)
      const unapproved = makeQuote({
        quoteId: 'UNAPPVD',
        toAmount: '100',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        allowanceResult: { allowanceTarget: '0x1', amount: '100' },
      });
      // Approved provider: toAmount=95 (within 10% → 95*1.1=104.5 > 100)
      const approved = makeQuote({
        quoteId: 'APPVD',
        toAmount: '95',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        approvedInfo: { isApproved: true },
      });

      const result = sortSwapQuotes([unapproved, approved], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      // Approved should be boosted to #1
      expect(result[0].quoteId).toBe('APPVD');
      expect(result[0].isBest).toBe(true);
    });

    it('does NOT elevate approved provider when gap > 10%', () => {
      const unapproved = makeQuote({
        quoteId: 'UNAPPVD',
        toAmount: '100',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        allowanceResult: { allowanceTarget: '0x1', amount: '100' },
      });
      // toAmount=80 → 80*1.1=88 < 100, NOT enough to boost
      const approved = makeQuote({
        quoteId: 'APPVD',
        toAmount: '80',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        approvedInfo: { isApproved: true },
      });

      const result = sortSwapQuotes([unapproved, approved], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      // Unapproved stays on top because 80*1.1=88 < 100
      expect(result[0].quoteId).toBe('UNAPPVD');
    });

    it('does not boost if best provider is already approved', () => {
      const approved1 = makeQuote({
        quoteId: 'APPVD1',
        toAmount: '100',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        approvedInfo: { isApproved: true },
      });
      const approved2 = makeQuote({
        quoteId: 'APPVD2',
        toAmount: '90',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        approvedInfo: { isApproved: true },
      });

      const result = sortSwapQuotes([approved1, approved2], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      // No boost needed because best is already approved (no allowanceResult)
      expect(result[0].quoteId).toBe('APPVD1');
    });
  });

  // -------------------------------------------------------------------------
  // Badge assignment
  // -------------------------------------------------------------------------
  describe('badge assignment', () => {
    it('assigns isBest to recommended #1', () => {
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      const best = result.find((q) => q.isBest);
      expect(best).toBeDefined();
    });

    it('assigns receivedBest to the highest original toAmount', () => {
      // C has toAmount=110, the highest
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      const recvBest = result.find((q) => q.receivedBest);
      expect(recvBest).toBeDefined();
      expect(recvBest!.quoteId).toBe('C');
    });

    it('assigns minGasCost to the lowest gas fee', () => {
      // B has fee=2, the lowest
      const result = sortSwapQuotes([quoteA, quoteB, quoteC], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      const minGas = result.find((q) => q.minGasCost);
      expect(minGas).toBeDefined();
      expect(minGas!.quoteId).toBe('B');
    });

    it('only assigns badges to quotes with toAmount', () => {
      const noAmount = makeQuote({
        quoteId: 'NONE',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 1 },
        estimatedTime: '5',
      });
      const result = sortSwapQuotes([noAmount], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      expect(result[0].isBest).toBeFalsy();
      expect(result[0].receivedBest).toBeFalsy();
      expect(result[0].minGasCost).toBeFalsy();
    });

    it('badges are independent — one quote can have multiple badges', () => {
      // Single quote with toAmount should get all 3 badges
      const single = makeQuote({
        quoteId: 'ONLY',
        toAmount: '100',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 5 },
        estimatedTime: '30',
      });
      const result = sortSwapQuotes([single], {
        sort: ESwapProviderSort.RECOMMENDED,
        fromTokenAmount: '50',
      });
      expect(result[0].isBest).toBe(true);
      expect(result[0].receivedBest).toBe(true);
      expect(result[0].minGasCost).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Limit filtering
  // -------------------------------------------------------------------------
  describe('limit filtering', () => {
    it('pushes quotes out of min range down in received sort', () => {
      const limited = makeQuote({
        quoteId: 'LIMITED',
        toAmount: '200',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        limit: { min: '100', max: '1000' },
      });
      const normal = makeQuote({
        quoteId: 'NORMAL',
        toAmount: '50',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
      });
      // fromTokenAmount=10 < limited.min=100 → LIMITED pushed down
      const result = sortSwapQuotes([limited, normal], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '10',
      });
      expect(result[0].quoteId).toBe('NORMAL');
    });

    it('pushes quotes out of max range down in received sort', () => {
      const limited = makeQuote({
        quoteId: 'LIMITED',
        toAmount: '200',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        limit: { min: '1', max: '100' },
      });
      const normal = makeQuote({
        quoteId: 'NORMAL',
        toAmount: '50',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
      });
      // fromTokenAmount=200 > limited.max=100 → LIMITED pushed down
      const result = sortSwapQuotes([limited, normal], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '200',
      });
      expect(result[0].quoteId).toBe('NORMAL');
    });

    it('skips limit filtering when fromTokenAmount is absent', () => {
      const limited = makeQuote({
        quoteId: 'LIMITED',
        toAmount: '200',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        limit: { min: '100', max: '1000' },
      });
      const normal = makeQuote({
        quoteId: 'NORMAL',
        toAmount: '50',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
      });
      // No fromTokenAmount → limit check should be skipped, sort by toAmount desc
      const result = sortSwapQuotes([limited, normal], {
        sort: ESwapProviderSort.RECEIVED,
      });
      expect(result[0].quoteId).toBe('LIMITED');
    });

    it('both zero-toAmount quotes: one with limit sorts before one without', () => {
      const withLimit = makeQuote({
        quoteId: 'WITH_LIMIT',
        toAmount: '0',
        limit: { min: '1', max: '100' },
      });
      const withoutLimit = makeQuote({
        quoteId: 'WITHOUT_LIMIT',
        toAmount: '0',
      });
      const result = sortSwapQuotes([withoutLimit, withLimit], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '50',
      });
      expect(result[0].quoteId).toBe('WITH_LIMIT');
    });
  });

  // -------------------------------------------------------------------------
  // Post-sort limit re-ordering
  // -------------------------------------------------------------------------
  describe('post-sort limit re-ordering', () => {
    it('re-sorts items with limits by min then max ascending', () => {
      const limitLow = makeQuote({
        quoteId: 'L_LOW',
        toAmount: '100',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        limit: { min: '1', max: '500' },
      });
      const limitHigh = makeQuote({
        quoteId: 'L_HIGH',
        toAmount: '200',
        fee: { percentageFee: 0, estimatedFeeFiatValue: 3 },
        estimatedTime: '20',
        limit: { min: '10', max: '1000' },
      });
      // Both have limits. Even though L_HIGH has higher toAmount,
      // the post-sort re-orders by min ascending (1 < 10)
      const result = sortSwapQuotes([limitHigh, limitLow], {
        sort: ESwapProviderSort.RECEIVED,
        fromTokenAmount: '50',
      });
      expect(result[0].quoteId).toBe('L_LOW');
    });
  });

  // -------------------------------------------------------------------------
  // Resets existing badge values
  // -------------------------------------------------------------------------
  it('resets pre-existing badge values before sorting', () => {
    const preBadged = makeQuote({
      quoteId: 'PRE',
      toAmount: '50',
      isBest: true,
      receivedBest: true,
      minGasCost: true,
      fee: { percentageFee: 0, estimatedFeeFiatValue: 10 },
    });
    const better = makeQuote({
      quoteId: 'BETTER',
      toAmount: '100',
      fee: { percentageFee: 0, estimatedFeeFiatValue: 1 },
    });
    const result = sortSwapQuotes([preBadged, better], {
      sort: ESwapProviderSort.RECOMMENDED,
      fromTokenAmount: '50',
    });
    const pre = result.find((q) => q.quoteId === 'PRE');
    // PRE should no longer have isBest or minGasCost (BETTER is better)
    expect(pre!.isBest).toBeFalsy();
    expect(pre!.minGasCost).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// selectBestQuote
// ---------------------------------------------------------------------------

describe('selectBestQuote', () => {
  // Fixtures specific to selectBestQuote
  const sqA = makeQuote({
    quoteId: 'SQ_A',
    toAmount: '100',
    info: { provider: 'providerA', providerName: 'Provider A' },
  });
  const sqB = makeQuote({
    quoteId: 'SQ_B',
    toAmount: '90',
    info: { provider: 'providerB', providerName: 'Provider B' },
  });
  const sqC = makeQuote({
    quoteId: 'SQ_C',
    toAmount: '110',
    info: { provider: 'providerC', providerName: 'Provider C' },
  });

  it('returns undefined for empty list', () => {
    expect(selectBestQuote([])).toBeUndefined();
  });

  it('returns first in list when no manual select', () => {
    const result = selectBestQuote([sqA, sqB, sqC]);
    expect(result?.quoteId).toBe('SQ_A');
  });

  it('returns matching quote when manual select matches by provider AND providerName', () => {
    const manual = makeQuote({
      quoteId: 'MANUAL',
      toAmount: '50',
      info: { provider: 'providerB', providerName: 'Provider B' },
    });
    const result = selectBestQuote([sqA, sqB, sqC], {
      manualSelect: manual,
    });
    expect(result?.quoteId).toBe('SQ_B');
  });

  it('falls through to first when manual match has no toAmount', () => {
    const noAmount = makeQuote({
      quoteId: 'SQ_NO_AMT',
      info: { provider: 'providerB', providerName: 'Provider B' },
      // no toAmount
    });
    const list = [sqA, noAmount, sqC];
    const manual = makeQuote({
      quoteId: 'MANUAL',
      toAmount: '50',
      info: { provider: 'providerB', providerName: 'Provider B' },
    });
    // matched quote has no toAmount → falls through
    // manual.unSupportReceiveAddressDifferent is undefined (falsy)
    // → finds first quote without unSupportReceiveAddressDifferent
    const result = selectBestQuote(list, { manualSelect: manual });
    expect(result?.quoteId).toBe('SQ_A');
  });

  it('manual select with unSupportReceiveAddressDifferent=false and no match: finds first compatible quote', () => {
    const unsupported = makeQuote({
      quoteId: 'SQ_UNSUP',
      toAmount: '200',
      info: { provider: 'providerX', providerName: 'Provider X' },
      unSupportReceiveAddressDifferent: true,
    });
    const supported = makeQuote({
      quoteId: 'SQ_SUP',
      toAmount: '80',
      info: { provider: 'providerY', providerName: 'Provider Y' },
    });
    const manual = makeQuote({
      quoteId: 'MANUAL',
      toAmount: '50',
      info: { provider: 'providerZ', providerName: 'Provider Z' },
      unSupportReceiveAddressDifferent: false,
    });
    // No match for providerZ in list.
    // manual.unSupportReceiveAddressDifferent is false (falsy)
    // → finds first quote without unSupportReceiveAddressDifferent=true
    const result = selectBestQuote([unsupported, supported], {
      manualSelect: manual,
    });
    expect(result?.quoteId).toBe('SQ_SUP');
  });

  it('manual select with unSupportReceiveAddressDifferent=true and no match: returns first in list', () => {
    const unsupported = makeQuote({
      quoteId: 'SQ_UNSUP',
      toAmount: '200',
      info: { provider: 'providerX', providerName: 'Provider X' },
      unSupportReceiveAddressDifferent: true,
    });
    const manual = makeQuote({
      quoteId: 'MANUAL',
      toAmount: '50',
      info: { provider: 'providerZ', providerName: 'Provider Z' },
      unSupportReceiveAddressDifferent: true,
    });
    // No match for providerZ. manual.unSupportReceiveAddressDifferent is true
    // → does NOT enter the unSupportReceiveAddressDifferent filter
    // → falls through to return sortedQuotes[0]
    const result = selectBestQuote([unsupported], {
      manualSelect: manual,
    });
    expect(result?.quoteId).toBe('SQ_UNSUP');
  });

  it('does not match if only provider matches but providerName differs', () => {
    const manual = makeQuote({
      quoteId: 'MANUAL',
      toAmount: '50',
      info: { provider: 'providerA', providerName: 'Different Name' },
    });
    // provider matches sqA but providerName does not
    // manual.unSupportReceiveAddressDifferent is undefined (falsy)
    // → finds first quote without unSupportReceiveAddressDifferent
    const result = selectBestQuote([sqA, sqB], { manualSelect: manual });
    expect(result?.quoteId).toBe('SQ_A');
  });
});
