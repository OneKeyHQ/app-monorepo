/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  SwapRevealSnapshotProvider,
  SwapSmoothReveal,
} from './SwapSmoothReveal';

let mockLayout = { width: 300, height: 120 };

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
    Stack: React.forwardRef<
      HTMLButtonElement,
      PropsWithChildren<{
        enterStyle?: unknown;
        height?: number;
        transition?: string;
        onLayout?: (event: {
          nativeEvent: { layout: { width: number; height: number } };
        }) => void;
      }>
    >(function MockStack(
      { children, enterStyle, height, onLayout, transition },
      ref,
    ) {
      if (!onLayout) {
        return (
          <div
            data-testid="reveal"
            data-height={height}
            data-enter={enterStyle ? 'animate' : 'none'}
            data-transition={transition ?? 'none'}
          >
            {children}
          </div>
        );
      }
      return (
        <button
          ref={(node) => {
            if (node) {
              node.getBoundingClientRect = () => ({
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: mockLayout.width,
                bottom: mockLayout.height,
                width: mockLayout.width,
                height: mockLayout.height,
                toJSON: () => ({}),
              });
            }
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="button"
          data-testid="measurement"
          onClick={() => onLayout({ nativeEvent: { layout: mockLayout } })}
        >
          {children}
        </button>
      );
    }),
  };
});

function RevealTree({
  mounted = true,
  visible = true,
  keepMounted = true,
  scopePending = false,
  snapshotPending = false,
  snapshotKey = 'recipient',
  snapshotScope = 'account-a-stock-a',
}: {
  mounted?: boolean;
  visible?: boolean;
  keepMounted?: boolean;
  scopePending?: boolean;
  snapshotPending?: boolean;
  snapshotKey?: string;
  snapshotScope?: string;
}) {
  return (
    <SwapRevealSnapshotProvider>
      {mounted ? (
        <SwapSmoothReveal
          visible={visible}
          keepMounted={keepMounted}
          snapshotKey={snapshotKey}
          snapshotScope={scopePending ? undefined : snapshotScope}
          snapshotPending={snapshotPending}
        >
          <span>content</span>
        </SwapSmoothReveal>
      ) : null}
    </SwapRevealSnapshotProvider>
  );
}

function measure(height: number, width = 300) {
  mockLayout = { width, height };
  fireEvent.click(screen.getByTestId('measurement'));
}

function expectReveal(height: number, enter: 'animate' | 'none') {
  const reveal = screen.getByTestId('reveal');
  expect(reveal.getAttribute('data-height')).toBe(String(height));
  expect(reveal.getAttribute('data-enter')).toBe(enter);
}

describe('SwapSmoothReveal snapshots', () => {
  beforeEach(() => {
    mockLayout = { width: 300, height: 120 };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('animates the first entry and restores measured height after remount', () => {
    const view = render(<RevealTree />);
    expectReveal(0, 'animate');
    measure(120);
    expectReveal(120, 'animate');

    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree />);
    expectReveal(120, 'none');
    expect(screen.getByText('content')).toBeTruthy();
  });

  it.each([
    ['different scope', 'recipient', 'account-b-stock-a'],
    ['different key', 'position', 'account-a-stock-a'],
  ])(
    'does not restore a snapshot for a %s',
    (_label, snapshotKey, snapshotScope) => {
      const view = render(<RevealTree />);
      measure(120);
      view.rerender(<RevealTree mounted={false} />);
      view.rerender(
        <RevealTree snapshotKey={snapshotKey} snapshotScope={snapshotScope} />,
      );
      expectReveal(0, 'animate');
    },
  );

  it('does not restore a row that was hidden before unmount', () => {
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree visible={false} />);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree />);
    expectReveal(0, 'animate');
  });

  it.each([120, 180])(
    'restores the current scope natural height %i after an immediate remount',
    (nextHeight) => {
      const view = render(<RevealTree />);
      measure(120);

      mockLayout = { width: 300, height: nextHeight };
      view.rerender(<RevealTree snapshotScope="account-b-stock-b" />);
      measure(0, 0);
      view.rerender(
        <RevealTree mounted={false} snapshotScope="account-b-stock-b" />,
      );
      mockLayout = { width: 300, height: nextHeight };
      view.rerender(<RevealTree snapshotScope="account-b-stock-b" />);
      expectReveal(nextHeight, 'none');
    },
  );

  it('restores the original height when the scope resolves after remount', () => {
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree scopePending />);

    view.rerender(<RevealTree />);
    expectReveal(120, 'none');
  });

  it('restores a visible row after a pending hidden state resolves', () => {
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree visible={false} snapshotPending />);

    view.rerender(<RevealTree />);
    expectReveal(120, 'none');
  });

  it('suppresses the transition only for the first restored frame after pending', () => {
    jest.useFakeTimers();
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree visible={false} snapshotPending />);
    view.rerender(<RevealTree />);

    expectReveal(120, 'none');
    expect(screen.getByTestId('reveal').getAttribute('data-transition')).toBe(
      'none',
    );

    act(() => {
      jest.advanceTimersByTime(20);
    });
    expectReveal(120, 'none');
    expect(screen.getByTestId('reveal').getAttribute('data-transition')).toBe(
      'smooth',
    );

    view.rerender(<RevealTree visible={false} />);
    expectReveal(0, 'animate');
    expect(screen.getByTestId('reveal').getAttribute('data-transition')).toBe(
      'smooth',
    );
    view.rerender(<RevealTree />);
    expectReveal(120, 'animate');
    expect(screen.getByTestId('reveal').getAttribute('data-transition')).toBe(
      'smooth',
    );
  });

  it('does not restore after hidden visibility is settled', () => {
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree visible={false} snapshotPending />);
    view.rerender(<RevealTree visible={false} />);
    view.rerender(<RevealTree />);
    expectReveal(0, 'animate');
  });

  it('continues to animate a real hide and show after restoration', () => {
    const view = render(<RevealTree />);
    measure(120);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree />);
    expectReveal(120, 'none');

    view.rerender(<RevealTree visible={false} />);
    expectReveal(0, 'animate');
    view.rerender(<RevealTree />);
    expectReveal(120, 'animate');
  });

  it('animates a subsequent show when the hidden child is unmounted', () => {
    const view = render(<RevealTree keepMounted={false} />);
    measure(120);
    view.rerender(<RevealTree mounted={false} keepMounted={false} />);
    view.rerender(<RevealTree keepMounted={false} />);
    expectReveal(120, 'none');

    view.rerender(<RevealTree visible={false} keepMounted={false} />);
    expect(screen.queryByTestId('reveal')).toBeNull();
    view.rerender(<RevealTree keepMounted={false} />);
    expectReveal(120, 'animate');
  });

  it('ignores hidden web measurements and does not restore without a valid measurement', () => {
    mockLayout = { width: 0, height: 0 };
    const view = render(<RevealTree />);
    measure(0, 0);
    view.rerender(<RevealTree mounted={false} />);
    view.rerender(<RevealTree />);
    expectReveal(0, 'animate');
  });
});
