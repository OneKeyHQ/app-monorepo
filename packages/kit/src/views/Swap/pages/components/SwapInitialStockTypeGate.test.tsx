/** @jest-environment jsdom */

import { StrictMode } from 'react';

import { render, screen } from '@testing-library/react';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { SwapInitialStockTypeGate } from './SwapInitialStockTypeGate';

let mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
const mockSwapTypeSwitchAction = jest.fn();

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: { swapTypeSwitchAction: mockSwapTypeSwitchAction },
  }),
  useSwapTypeSwitchAtom: () => [mockSwapTypeSwitch],
}));

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ networkId: 'evm--56' }),
}));

describe('SwapInitialStockTypeGate', () => {
  beforeEach(() => {
    mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
    mockSwapTypeSwitchAction.mockReset();
  });

  it('gates the default Swap paint and runs the existing Stock switch action', () => {
    const { rerender } = render(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Stock content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Stock content')).toBeNull();
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.STOCK,
      'evm--56',
    );

    mockSwapTypeSwitch = ESwapTabSwitchType.STOCK;
    rerender(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Stock content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Stock content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
  });

  it('runs the initial Stock boundary action only once in Strict Mode', () => {
    render(
      <StrictMode>
        <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
          <div>Stock content</div>
        </SwapInitialStockTypeGate>
      </StrictMode>,
    );

    expect(screen.queryByText('Stock content')).toBeNull();
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
  });

  it('does not alter ordinary Swap and Limit initialization', () => {
    const { rerender } = render(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.SWAP}>
        <div>Swap content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Swap content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();

    rerender(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.LIMIT}>
        <div>Swap content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Swap content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
  });

  it('never re-gates later user tab changes after initial Stock resolves', () => {
    mockSwapTypeSwitch = ESwapTabSwitchType.STOCK;
    const { rerender } = render(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Trade content</div>
      </SwapInitialStockTypeGate>,
    );
    expect(screen.queryByText('Trade content')).not.toBeNull();

    mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
    rerender(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Trade content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Trade content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
  });
});
