import { resolveApproveSpender } from './resolve-approve-spender';

const ORDER_TARGET = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const BUILD_TARGET = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const SWAP_TX_TO = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

describe('resolveApproveSpender', () => {
  it('prefers orderAllowance target when present', () => {
    expect(resolveApproveSpender(ORDER_TARGET, BUILD_TARGET, SWAP_TX_TO)).toBe(
      ORDER_TARGET,
    );
  });

  it('falls back to buildAllowance target when order has none', () => {
    expect(resolveApproveSpender(undefined, BUILD_TARGET, SWAP_TX_TO)).toBe(
      BUILD_TARGET,
    );
  });

  it('falls back to swapTxTo when neither allowance has a target', () => {
    expect(resolveApproveSpender(undefined, undefined, SWAP_TX_TO)).toBe(
      SWAP_TX_TO,
    );
  });

  it('never returns undefined — swapTxTo is always the final fallback', () => {
    const result = resolveApproveSpender(undefined, undefined, SWAP_TX_TO);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('routes fallback warnings through the provided output callback', () => {
    const warn = jest.fn();

    resolveApproveSpender(undefined, undefined, SWAP_TX_TO, { warn });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('No allowanceTarget'),
    );
  });
});
