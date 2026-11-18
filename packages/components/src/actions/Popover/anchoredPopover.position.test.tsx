/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { renderHook, waitFor } from '@testing-library/react';

import { useAnchoredPosition } from './anchoredPopover';

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OVERLAY_LEVEL_ORDER: {},
  getAnchoredTransformOrigin: () => 'right top',
}));

it('follows an external toolbar moved by a sibling scroller and stops after closing', async () => {
  const anchor = document.createElement('button');
  const scroller = document.createElement('div');
  const panel = document.createElement('div');
  document.body.append(anchor, scroller, panel);
  let top = 300;
  const measure = jest
    .spyOn(anchor, 'getBoundingClientRect')
    .mockImplementation(() => ({
      x: 240,
      y: top,
      width: 38,
      height: 38,
      top,
      bottom: top + 38,
      left: 240,
      right: 278,
      toJSON: () => ({}),
    }));
  const triggerRef = { current: null };
  const { rerender, unmount } = renderHook(
    ({ open }) =>
      useAnchoredPosition({
        open,
        triggerRef,
        anchorElement: anchor,
        anchorRect: { x: 240, y: 300, width: 38, height: 38 },
        panel,
        placement: 'bottom-end',
        offset: 8,
        allowFlip: false,
      }),
    { initialProps: { open: true } },
  );
  try {
    await waitFor(() => expect(panel.style.top).toBe('346px'));
    top = 140;
    scroller.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(panel.style.top).toBe('186px'));
    rerender({ open: false });
    measure.mockClear();
    top = 80;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(measure).not.toHaveBeenCalled();
    expect(panel.style.top).toBe('186px');
  } finally {
    unmount();
    anchor.remove();
    scroller.remove();
    panel.remove();
  }
});
