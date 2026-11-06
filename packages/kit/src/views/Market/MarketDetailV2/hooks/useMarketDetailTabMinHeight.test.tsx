/** @jest-environment jsdom */

import { useState } from 'react';
import type { Ref } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { useMarketDetailTabMinHeight } from './useMarketDetailTabMinHeight';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: false,
}));

function DetailTabs({ identity = 'AAPL' }: { identity?: string }) {
  const { ref, minHeight, preserveScrollPosition } =
    useMarketDetailTabMinHeight(identity);
  const [position, setPosition] = useState(false);
  return (
    <div
      ref={ref as unknown as Ref<HTMLDivElement>}
      data-testid="tabs"
      style={{ minHeight }}
    >
      <button
        type="button"
        onClick={() => {
          preserveScrollPosition();
          setPosition((value) => !value);
        }}
      >
        {position ? 'Position' : 'Overview'}
      </button>
    </div>
  );
}

it.each([100, -100])(
  'preserves enough scroll range when the tab starts at %dpx in the viewport',
  (offset) => {
    const { container, getByTestId, getByRole } = render(
      <div style={{ overflowY: 'auto' }}>
        <DetailTabs />
      </div>,
    );
    const scroll = container.firstElementChild as HTMLDivElement;
    Object.defineProperty(scroll, 'clientHeight', { value: 800 });
    Object.defineProperty(scroll, 'clientTop', { value: 2 });
    jest.spyOn(scroll, 'getBoundingClientRect').mockReturnValue({
      top: 40,
    } as DOMRect);
    const tabs = getByTestId('tabs');
    jest.spyOn(tabs, 'getBoundingClientRect').mockReturnValue({
      top: 42 + offset,
    } as DOMRect);

    fireEvent.click(getByRole('button'));

    expect(getByRole('button').textContent).toBe('Position');
    expect(tabs.style.minHeight).toBe(`${800 - offset}px`);
  },
);

it('releases reserved height on return to the top and on detail identity changes', () => {
  const { container, getByTestId, getByRole, rerender, unmount } = render(
    <div style={{ overflowY: 'auto' }}>
      <DetailTabs identity="AAPL" />
    </div>,
  );
  const scroll = container.firstElementChild as HTMLDivElement;
  Object.defineProperty(scroll, 'clientHeight', { value: 800 });
  jest
    .spyOn(scroll, 'getBoundingClientRect')
    .mockReturnValue({ top: 0 } as DOMRect);
  const tabs = getByTestId('tabs');
  jest
    .spyOn(tabs, 'getBoundingClientRect')
    .mockReturnValue({ top: -500 } as DOMRect);
  const removeListener = jest.spyOn(scroll, 'removeEventListener');
  scroll.scrollTop = 900;
  fireEvent.click(getByRole('button'));
  expect(tabs.style.minHeight).toBe('1300px');
  scroll.scrollTop = 0;
  fireEvent.scroll(scroll);
  expect(tabs.style.minHeight).toBe('0');
  scroll.scrollTop = 900;
  fireEvent.click(getByRole('button'));
  expect(tabs.style.minHeight).toBe('1300px');
  rerender(
    <div style={{ overflowY: 'auto' }}>
      <DetailTabs identity="MSFT" />
    </div>,
  );
  expect(tabs.style.minHeight).toBe('0');
  expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  fireEvent.click(getByRole('button'));
  const removals = removeListener.mock.calls.length;
  unmount();
  expect(removeListener.mock.calls.length).toBe(removals + 1);
});
