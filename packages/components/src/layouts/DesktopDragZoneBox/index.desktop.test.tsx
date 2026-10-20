/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import { act } from 'react';
import type { HTMLAttributes } from 'react';

import assert from 'node:assert/strict';

import { createRoot } from 'react-dom/client';

import { DesktopDragZoneBox } from './index.desktop';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktopWithCustomTitleBar: true },
}));
jest.mock('../../primitives', () => ({
  Stack: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

function setRect(
  el: Element,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    }),
  });
}

function regions(kind: 'drag' | 'no-drag') {
  return Array.from(
    document.querySelectorAll(`[data-onekey-syn-region="${kind}"]`),
    (el) => el.getAttribute('style'),
  );
}

async function settleRegions() {
  await Promise.resolve();
  jest.advanceTimersByTime(700);
}

it('keeps portalled overlay controls clickable and restores header dragging on close', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })),
  });
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <DesktopDragZoneBox>
        <button type="button">Back</button>
      </DesktopDragZoneBox>,
    );
  });
  const header = container.querySelector('.app-region-drag');
  const back = container.querySelector('button');
  assert(header && back, 'Header did not mount');
  setRect(header, 72, 0, 1200, 52);
  setRect(back, 85, 7, 38, 38);
  globalThis.dispatchEvent(new Event('resize'));
  await settleRegions();
  const headerDrag = regions('drag');
  const headerHoles = regions('no-drag');
  expect(headerDrag).toHaveLength(1);
  expect(headerHoles).toHaveLength(1);

  const layer = document.createElement('div');
  layer.setAttribute('data-onekey-overlay-layer', 'toast');
  layer.innerHTML =
    '<div data-onekey-overlay-entry><button>Close</button></div>';
  const close = layer.querySelector('button');
  assert(close, 'Close did not mount');
  const animation = new EventTarget();
  Object.defineProperty(animation, 'playState', { value: 'running' });
  Object.defineProperty(layer, 'getAnimations', { value: () => [animation] });
  setRect(close, 735, 20, 58, 30);
  document.body.appendChild(layer);
  await settleRegions();
  expect(regions('drag')).toEqual(headerDrag);
  expect(regions('no-drag')).toEqual([
    ...headerHoles,
    expect.stringContaining(
      'left: 735px; top: 20px; width: 58px; height: 30px;',
    ),
  ]);

  setRect(close, 735, 32, 58, 30);
  animation.dispatchEvent(new Event('finish'));
  await settleRegions();
  expect(regions('no-drag')[1]).toContain(
    'left: 735px; top: 32px; width: 58px; height: 30px;',
  );
  setRect(close, 800, 20, 90, 30);
  close.textContent = 'Dismiss';
  await settleRegions();
  expect(regions('no-drag')[1]).toContain(
    'left: 800px; top: 20px; width: 90px; height: 30px;',
  );
  layer.setAttribute('aria-hidden', 'true');
  await settleRegions();
  expect(regions('no-drag')).toEqual(headerHoles);
  layer.removeAttribute('aria-hidden');
  await settleRegions();
  expect(regions('no-drag')).toHaveLength(2);
  layer.remove();
  await settleRegions();
  expect(regions('drag')).toEqual(headerDrag);
  expect(regions('no-drag')).toEqual(headerHoles);
  await act(async () => root.unmount());
  container.remove();
  jest.useRealTimers();
});
