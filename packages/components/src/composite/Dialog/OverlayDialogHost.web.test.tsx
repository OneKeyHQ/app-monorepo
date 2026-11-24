/** @jest-environment jsdom */
import type { ComponentType, ReactNode } from 'react';

import path from 'path';

import { act, render } from '@testing-library/react';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';

jest.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: { absoluteFill: {} },
}));

const packageDir = path.dirname(
  require.resolve('@onekeyfe/react-native-native-overlay/package.json'),
);
// Load the published entry used by Web/Desktop, including its real controller,
// portal, and visibility observer. Helper-only tests cannot catch missing imports.
const { OverlayView } = jest.requireActual<{
  OverlayView: ComponentType<IOverlayViewProps>;
}>(path.join(packageDir, 'lib/module/OverlayView.web.js'));
const animation = {
  enter: { type: 'none' },
  exit: { type: 'none' },
} as const;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 200,
    left: 0,
    right: 300,
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each(['center', 'sheet'] as const)(
  'opens the compiled %s host and reports visibility once',
  async (presentation) => {
    const onVisible = jest.fn();
    const view = render(
      <OverlayView
        visible
        presentation={presentation}
        animation={animation}
        blocking={false}
        backdrop={false}
        onVisible={onVisible}
      >
        <div>Share card</div>
      </OverlayView>,
    );
    expect(view.getByText('Share card')).toBeTruthy();
    expect(onVisible).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(32);
    });
    expect(onVisible).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(32);
    });
    expect(onVisible).toHaveBeenCalledTimes(1);
  },
);
