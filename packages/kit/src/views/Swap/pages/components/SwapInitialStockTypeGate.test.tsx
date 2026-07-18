/** @jest-environment jsdom */

import { StrictMode } from 'react';

import { render, screen } from '@testing-library/react';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { SwapInitialStockTypeGate } from './SwapInitialStockTypeGate';

let mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
const mockSwapTypeSwitchAction = jest.fn();
const mockLogInitialStockTypeSwitchError = jest.fn();
const mockUseSwapActions = jest.fn(() => ({
  current: { swapTypeSwitchAction: mockSwapTypeSwitchAction },
}));
const mockUseSwapAddressInfo = jest.fn(() => ({ networkId: 'evm--56' }));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => mockUseSwapActions(),
  useSwapTypeSwitchAtom: () => [mockSwapTypeSwitch],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (...args: unknown[]) => {
          mockLogInitialStockTypeSwitchError(...args);
        },
      },
    },
  },
}));

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => mockUseSwapAddressInfo(),
}));

describe('SwapInitialStockTypeGate', () => {
  beforeEach(() => {
    mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
    mockSwapTypeSwitchAction.mockReset();
    mockSwapTypeSwitchAction.mockResolvedValue(undefined);
    mockUseSwapActions.mockClear();
    mockUseSwapAddressInfo.mockClear();
    mockLogInitialStockTypeSwitchError.mockClear();
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
    expect(mockUseSwapActions).not.toHaveBeenCalled();
    expect(mockUseSwapAddressInfo).not.toHaveBeenCalled();

    rerender(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.LIMIT}>
        <div>Swap content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Swap content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
    expect(mockUseSwapActions).not.toHaveBeenCalled();
    expect(mockUseSwapAddressInfo).not.toHaveBeenCalled();

    rerender(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Swap content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(screen.queryByText('Swap content')).not.toBeNull();
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
    expect(mockUseSwapActions).not.toHaveBeenCalled();
    expect(mockUseSwapAddressInfo).not.toHaveBeenCalled();
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

  it('releases the blank gate when the initial Stock switch fails', async () => {
    mockSwapTypeSwitchAction.mockRejectedValueOnce(
      new Error('Stock switch failed'),
    );

    render(
      <SwapInitialStockTypeGate initialSwapType={ESwapTabSwitchType.STOCK}>
        <div>Fallback trade content</div>
      </SwapInitialStockTypeGate>,
    );

    expect(await screen.findByText('Fallback trade content')).not.toBeNull();
    expect(mockLogInitialStockTypeSwitchError).toHaveBeenCalledWith(
      'swap_initialStockType_switchError: Stock switch failed',
    );
  });
});
