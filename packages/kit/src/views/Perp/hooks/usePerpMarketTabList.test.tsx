/** @jest-environment jsdom */

import { useState } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { usePerpMarketTabList } from './usePerpMarketTabList';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

const items = [{ key: 'orderBook' }, { key: 'trades' }] as const;

function Tabs() {
  const [selected, setSelected] = useState<'orderBook' | 'trades'>('orderBook');
  const tabs = usePerpMarketTabList(selected, items);
  return (
    <>
      <div role="tablist">
        {items.map(({ key }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === selected}
            {...tabs.getButtonProps(key)}
            onClick={() => setSelected(key)}
          >
            {key}
          </button>
        ))}
      </div>
      {items.map(({ key }) => (
        <div key={key} {...tabs.getPanelProps(key)} hidden={selected !== key} />
      ))}
    </>
  );
}

it('moves keyboard focus, preserves manual activation, and links tabs to panels', () => {
  const { getByRole } = render(<Tabs />);
  const book = getByRole('tab', { name: 'orderBook' });
  const trades = getByRole('tab', { name: 'trades' });
  act(() => book.focus());
  fireEvent.keyDown(book, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(trades);
  expect(trades.tabIndex).toBe(0);
  expect(book.getAttribute('aria-selected')).toBe('true');
  fireEvent.click(trades);
  const panel = getByRole('tabpanel');
  expect(trades.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.getAttribute('aria-labelledby')).toBe(trades.id);
  fireEvent.keyDown(trades, { key: 'Home' });
  expect(document.activeElement).toBe(book);
  fireEvent.keyDown(book, { key: 'End' });
  expect(document.activeElement).toBe(trades);
  fireEvent.keyDown(trades, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(book);
  fireEvent.keyDown(book, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(trades);
});
