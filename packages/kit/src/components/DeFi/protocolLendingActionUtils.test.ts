import { resolveProtocolLendingRepayAmountState } from './protocolLendingActionUtils';

describe('protocolLendingActionUtils', () => {
  it('uses server maxRepayBalance for repay max before wallet balance resolves', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '2',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.valueForMax).toBe('2');
    expect(state.isFullClose).toBe(false);
    expect(state.isAmountInsufficient).toBe(false);
  });

  it('does not mark wallet-capped max as full repay', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '2',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayWalletBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.isFullClose).toBe(false);
  });

  it('marks amount above repay max as insufficient', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '3',
      referenceBalance: '10',
      maxRepayBalance: '2',
      repayAllTargetAmount: '10',
    });

    expect(state.isAmountInsufficient).toBe(true);
  });

  it('uses the raw debt amount as the full-repay target', () => {
    const state = resolveProtocolLendingRepayAmountState({
      amount: '10.123456',
      referenceBalance: '10.12',
      maxRepayBalance: '10.123456',
      repayAllTargetAmount: '10.123456',
    });

    expect(state.valueForMax).toBe('10.123456');
    expect(state.isFullClose).toBe(true);
  });
});
