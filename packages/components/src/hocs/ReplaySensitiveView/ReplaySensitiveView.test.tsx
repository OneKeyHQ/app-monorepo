/** @jest-environment jsdom */
import { cleanup, render, renderHook } from '@testing-library/react';

import { useReplaySensitive } from '../../hooks/useReplaySensitive';

import { ReplaySensitiveView } from './ReplaySensitiveView';
import { withReplayNoCaptureTestId } from './types';
import { withReplaySensitive } from './withReplaySensitive';

const mockReleases: jest.Mock[] = [];
const mockAcquire = jest.fn((_tag: string) => {
  const release = jest.fn();
  mockReleases.push(release);
  return release;
});

jest.mock('@onekeyhq/shared/src/modules3rdParty/posthog/replayGate', () => ({
  acquireReplayPause: (tag: string) => mockAcquire(tag),
}));

describe('replay sensitive primitives', () => {
  beforeEach(() => {
    mockAcquire.mockClear();
    mockReleases.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('holds a pause while mounted and active', () => {
    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useReplaySensitive(active, 'test'),
      { initialProps: { active: true } },
    );
    expect(mockAcquire).toHaveBeenCalledWith('test');
    expect(mockReleases[0]).not.toHaveBeenCalled();

    rerender({ active: false });
    expect(mockReleases[0]).toHaveBeenCalledTimes(1);
    expect(mockAcquire).toHaveBeenCalledTimes(1);

    rerender({ active: true });
    expect(mockAcquire).toHaveBeenCalledTimes(2);
    unmount();
    expect(mockReleases[1]).toHaveBeenCalledTimes(1);
  });

  it('renders children without a wrapper element on web', () => {
    const { container } = render(
      <ReplaySensitiveView tag="view">
        <span data-testid="child">secret</span>
      </ReplaySensitiveView>,
    );
    expect(container.innerHTML).toBe('<span data-testid="child">secret</span>');
    expect(mockAcquire).toHaveBeenCalledWith('view');
  });

  it('wraps a component and forwards its props', () => {
    function Content({ label }: { label: string }) {
      return <span>{label}</span>;
    }
    const Wrapped = withReplaySensitive(Content, 'wrapped');
    const { container, unmount } = render(<Wrapped label="pin" />);
    expect(container.textContent).toBe('pin');
    expect(mockAcquire).toHaveBeenCalledWith('wrapped');
    expect(Wrapped.displayName).toBe('withReplaySensitive(Content)');
    unmount();
    expect(mockReleases[0]).toHaveBeenCalledTimes(1);
  });

  it('keeps an existing test id as a prefix of the native marker', () => {
    expect(withReplayNoCaptureTestId()).toBe('ph-no-capture');
    expect(withReplayNoCaptureTestId('password-input')).toBe(
      'password-input-ph-no-capture',
    );
  });
});
