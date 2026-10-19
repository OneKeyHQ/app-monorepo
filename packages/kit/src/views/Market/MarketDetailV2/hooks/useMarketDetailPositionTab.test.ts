/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { ITabContainerRef } from '@onekeyhq/components';

import {
  useMarketDetailPositionTab,
  useMarketDetailPositionTabContainer,
} from './useMarketDetailPositionTab';

let mockPreferPosition = false;
const mockSetPreference = jest.fn(
  ({ preferPosition }: { preferPosition: boolean }) => {
    mockPreferPosition = preferPosition;
  },
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailPositionTabPersistAtom: () => [
    { preferPosition: mockPreferPosition },
    mockSetPreference,
  ],
}));

type IProps = {
  assetKey: string | undefined;
  isPortfolioSettled: boolean;
  hasPosition: boolean;
};

function renderTabHook(initialProps: IProps) {
  return renderHook((props: IProps) => useMarketDetailPositionTab(props), {
    initialProps,
  });
}

describe('useMarketDetailPositionTab', () => {
  beforeEach(() => {
    mockPreferPosition = false;
    mockSetPreference.mockClear();
  });

  it('opens on the page default when position was not the last choice', () => {
    const { result } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: true,
      hasPosition: true,
    });

    expect(result.current.showPosition).toBe(false);
  });

  it('keeps the position tab while the portfolio loads, then keeps it when there is a position', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: false,
      hasPosition: false,
    });

    expect(result.current.showPosition).toBe(true);

    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: true });
    expect(result.current.showPosition).toBe(true);
  });

  it('falls back to the default when the asset has no position, without forgetting the choice', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: false,
      hasPosition: false,
    });

    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: false });

    expect(result.current.showPosition).toBe(false);
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('records a tapped tab and lets a later portfolio result leave it alone', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: false,
      hasPosition: false,
    });

    act(() => result.current.selectTab(true));
    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: false });

    expect(result.current.showPosition).toBe(true);
    expect(mockSetPreference).toHaveBeenCalledWith({ preferPosition: true });

    act(() => result.current.selectTab(false));
    expect(result.current.showPosition).toBe(false);
    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: false,
    });
  });

  it('checks each asset again when switching inside the same page', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'NVDA',
      isPortfolioSettled: true,
      hasPosition: true,
    });
    expect(result.current.showPosition).toBe(true);

    // The new asset's request is in flight: stay on the position tab.
    rerender({ assetKey: 'TSM', isPortfolioSettled: false, hasPosition: true });
    expect(result.current.showPosition).toBe(true);

    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: false });
    expect(result.current.showPosition).toBe(false);

    // Back to a held asset: the position tab returns.
    rerender({
      assetKey: 'NVDA',
      isPortfolioSettled: false,
      hasPosition: false,
    });
    expect(result.current.showPosition).toBe(true);
    rerender({ assetKey: 'NVDA', isPortfolioSettled: true, hasPosition: true });
    expect(result.current.showPosition).toBe(true);
  });

  it('carries a position tab picked on one asset to the next', () => {
    const { result, rerender } = renderTabHook({
      assetKey: 'NVDA',
      isPortfolioSettled: true,
      hasPosition: true,
    });

    act(() => result.current.selectTab(true));
    rerender({
      assetKey: 'AAPL',
      isPortfolioSettled: false,
      hasPosition: false,
    });

    expect(result.current.showPosition).toBe(true);
  });
});

describe('useMarketDetailPositionTab skeleton', () => {
  beforeEach(() => {
    mockPreferPosition = false;
    mockSetPreference.mockClear();
  });

  it('keeps the skeleton until the holdings are known', () => {
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: false,
      hasPosition: false,
    });
    expect(result.current.isPositionPending).toBe(true);

    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: true });
    expect(result.current.isPositionPending).toBe(false);
  });

  it('keeps the skeleton on an automatically opened empty position instead of flashing the empty state', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: false,
      hasPosition: false,
    });

    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: false });

    expect(result.current.showPosition).toBe(false);
    expect(result.current.isPositionPending).toBe(true);
  });

  it('shows the empty state once the user opens the position tab', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM',
      isPortfolioSettled: true,
      hasPosition: false,
    });

    act(() => result.current.selectTab(true));
    rerender({ assetKey: 'TSM', isPortfolioSettled: true, hasPosition: false });

    expect(result.current.isPositionPending).toBe(false);
  });
});

describe('useMarketDetailPositionTab visits', () => {
  beforeEach(() => {
    mockPreferPosition = false;
    mockSetPreference.mockClear();
  });

  it('shows the empty state when held positions empty out after settling', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM:wallet-a',
      isPortfolioSettled: true,
      hasPosition: true,
    });
    expect(result.current.showPosition).toBe(true);

    // Sold everything on this page: stay on My position, show "No data".
    rerender({
      assetKey: 'TSM:wallet-a',
      isPortfolioSettled: true,
      hasPosition: false,
    });
    expect(result.current.showPosition).toBe(true);
    expect(result.current.isPositionPending).toBe(false);
  });

  it('decides again when the account changes on the same asset', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'TSM:wallet-a',
      isPortfolioSettled: true,
      hasPosition: false,
    });
    expect(result.current.showPosition).toBe(false);

    rerender({
      assetKey: 'TSM:wallet-b',
      isPortfolioSettled: false,
      hasPosition: false,
    });
    expect(result.current.showPosition).toBe(true);
    rerender({
      assetKey: 'TSM:wallet-b',
      isPortfolioSettled: true,
      hasPosition: true,
    });
    expect(result.current.showPosition).toBe(true);
  });

  it('forgets a tap from an earlier visit, so returning to an unheld asset keeps the skeleton', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderTabHook({
      assetKey: 'A',
      isPortfolioSettled: true,
      hasPosition: true,
    });
    act(() => result.current.selectTab(true));

    rerender({ assetKey: 'B', isPortfolioSettled: true, hasPosition: true });
    rerender({ assetKey: 'A', isPortfolioSettled: true, hasPosition: false });

    expect(result.current.isPositionPending).toBe(true);
    expect(result.current.showPosition).toBe(false);
  });
});

describe('useMarketDetailPositionTabContainer', () => {
  type IContainerProps = IProps & { defaultTabName: string | undefined };
  const positionTabName = 'My position';

  function renderContainerHook(initialProps: IContainerProps) {
    const jumpToTab = jest.fn();
    const view = renderHook(
      (props: IContainerProps) => {
        const container = useMarketDetailPositionTabContainer({
          ...props,
          positionTabName,
        });
        container.tabsRef.current = {
          jumpToTab,
        } as unknown as ITabContainerRef;
        return container;
      },
      { initialProps },
    );
    return { ...view, jumpToTab };
  }

  beforeEach(() => {
    mockPreferPosition = false;
    mockSetPreference.mockClear();
  });

  it('opens on the position tab when that was the last choice', () => {
    mockPreferPosition = true;
    const { result } = renderContainerHook({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: false,
      hasPosition: false,
      defaultTabName: 'Overview',
    });

    expect(result.current.initialTabName).toBe(positionTabName);
  });

  it('jumps to the default tab when the asset has no position, without recording that jump', () => {
    mockPreferPosition = true;
    const { result, rerender, jumpToTab } = renderContainerHook({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: false,
      hasPosition: false,
      defaultTabName: 'Overview',
    });

    rerender({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: true,
      hasPosition: false,
      defaultTabName: 'Overview',
    });

    expect(jumpToTab).toHaveBeenCalledWith('Overview');
    expect(result.current.initialTabName).toBeUndefined();

    // The container reports the jump back; it is not the user's choice.
    act(() => result.current.handleTabChange({ tabName: 'Overview' }));
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('shows the empty state when the position tab is itself the default', () => {
    mockPreferPosition = true;
    const { result } = renderContainerHook({
      assetKey: 'btc--0:',
      isPortfolioSettled: true,
      hasPosition: false,
      defaultTabName: positionTabName,
    });

    expect(result.current.isPositionPending).toBe(false);
  });

  it('keeps the jump guard when a user tap lands before the jump event', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderContainerHook({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: false,
      hasPosition: false,
      defaultTabName: 'Overview',
    });
    rerender({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: true,
      hasPosition: false,
      defaultTabName: 'Overview',
    });

    act(() => result.current.handleTabChange({ tabName: positionTabName }));
    act(() => result.current.handleTabChange({ tabName: 'Overview' }));

    expect(mockSetPreference).toHaveBeenCalledTimes(1);
    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: true,
    });
  });

  it('records the tabs the user picks without jumping', () => {
    const { result, jumpToTab } = renderContainerHook({
      assetKey: 'evm--1:0xabc',
      isPortfolioSettled: true,
      hasPosition: true,
      defaultTabName: 'Overview',
    });

    act(() => result.current.handleTabChange({ tabName: positionTabName }));
    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: true,
    });

    act(() => result.current.handleTabChange({ tabName: 'Holders' }));
    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: false,
    });
    expect(jumpToTab).not.toHaveBeenCalled();
  });
});
