/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useInviteHeroAnimation } from './useInviteHeroAnimation';

let mockFocusCleanup: (() => void) | undefined;

jest.mock('@react-navigation/core', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    // Runs once on mount, like a focused screen.
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockFocusCleanup = effect();
    }, [effect]);
  },
}));

jest.mock('@onekeyhq/components', () => ({
  usePageWidth: () => 393,
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage',
  () => ({ getInviteCodeStepImageHeight: () => 200 }),
);

function setup(isInviteTab = true) {
  const setPaused = jest.fn();
  const hook = renderHook(
    ({ tab }: { tab: boolean }) => useInviteHeroAnimation(tab),
    { initialProps: { tab: isInviteTab } },
  );
  hook.result.current.controlRef.current = { setPaused };
  return { hook, setPaused };
}

describe('useInviteHeroAnimation', () => {
  it('pauses once when the illustration scrolls away and resumes on return', () => {
    const { hook, setPaused } = setup();

    act(() => {
      hook.result.current.onScrollOffset(120);
      hook.result.current.onScrollOffset(260);
      hook.result.current.onScrollOffset(400);
    });
    expect(setPaused.mock.calls).toEqual([[true]]);

    act(() => {
      hook.result.current.onScrollOffset(80);
    });
    expect(setPaused).toHaveBeenLastCalledWith(false);
  });

  it('pauses while covered by another page and on the other tab', () => {
    const { hook, setPaused } = setup();

    act(() => {
      mockFocusCleanup?.();
    });
    expect(setPaused).toHaveBeenLastCalledWith(true);

    hook.rerender({ tab: false });
    expect(setPaused).toHaveBeenLastCalledWith(true);
  });
});
