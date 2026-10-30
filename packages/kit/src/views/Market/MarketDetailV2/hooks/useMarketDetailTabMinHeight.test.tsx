/** @jest-environment jsdom */

import { useState } from 'react';
import type { Ref } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { useMarketDetailTabMinHeight } from './useMarketDetailTabMinHeight';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: false,
}));

function DetailTabs() {
  const { ref, minHeight, preserveScrollPosition } =
    useMarketDetailTabMinHeight();
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
