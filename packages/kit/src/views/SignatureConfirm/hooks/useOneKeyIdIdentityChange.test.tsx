/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/SignatureConfirm/hooks/useOneKeyIdIdentityChange.test.tsx

OK-64746: a Gas Account quote is bound to the OneKey ID member it was
estimated for, and Prime rejects the send when the identity changed in
between. The confirm page therefore re-estimates when the login state or the
member changes while it is open — but not on mount, and not when the same
member merely refreshes its token. A change seen while the hook is disabled
(submission in flight) is held and delivered once it is re-enabled.
*/
import { renderHook } from '@testing-library/react';

const mockState = {
  prime: {
    isLoggedIn: false,
    onekeyUserId: undefined as string | undefined,
  },
};

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimePersistAtom: () => [mockState.prime],
}));

// eslint-disable-next-line import/first
import {
  getOneKeyIdIdentityKey,
  useOneKeyIdIdentityChange,
} from './useOneKeyIdIdentityChange';

describe('getOneKeyIdIdentityKey', () => {
  it('is stable for the same logged-in member across token refreshes', () => {
    expect(
      getOneKeyIdIdentityKey({ isLoggedIn: true, onekeyUserId: 'user-a' }),
    ).toBe(
      getOneKeyIdIdentityKey({ isLoggedIn: true, onekeyUserId: 'user-a' }),
    );
  });

  it('differs between members and between logged in / logged out', () => {
    const a = getOneKeyIdIdentityKey({
      isLoggedIn: true,
      onekeyUserId: 'user-a',
    });
    const b = getOneKeyIdIdentityKey({
      isLoggedIn: true,
      onekeyUserId: 'user-b',
    });
    const anonymous = getOneKeyIdIdentityKey({
      isLoggedIn: false,
      onekeyUserId: 'user-a',
    });
    expect(a).not.toBe(b);
    expect(a).not.toBe(anonymous);
  });
});

describe('useOneKeyIdIdentityChange', () => {
  beforeEach(() => {
    mockState.prime = { isLoggedIn: false, onekeyUserId: undefined };
  });

  function renderChangeHook(enabled = true) {
    const onChange = jest.fn();
    // `rerender()` without props re-renders with the initial `enabled`.
    const rendered = renderHook(
      (props?: { enabled: boolean }) =>
        useOneKeyIdIdentityChange({
          enabled: props?.enabled ?? enabled,
          onChange,
        }),
      { initialProps: { enabled } },
    );
    return { onChange, rendered };
  }

  it('does not fire on mount', () => {
    const { onChange } = renderChangeHook();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires once when the user logs in after the estimate', () => {
    const { onChange, rendered } = renderChangeHook();
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    rendered.rerender();
    expect(onChange).toHaveBeenCalledTimes(1);
    rendered.rerender();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('fires when the member changes or logs out', () => {
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    const { onChange, rendered } = renderChangeHook();
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-b' };
    rendered.rerender();
    mockState.prime = { isLoggedIn: false, onekeyUserId: undefined };
    rendered.rerender();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores a token refresh for the same member', () => {
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    const { onChange, rendered } = renderChangeHook();
    // A new atom object with the same identity (token refresh / profile sync).
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    rendered.rerender();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays silent while disabled', () => {
    const { onChange, rendered } = renderChangeHook(false);
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    rendered.rerender({ enabled: false });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('delivers a change seen while disabled once re-enabled', () => {
    // Submission in flight (disabled) when the user logs in; the stale quote
    // must be dropped as soon as the attempt ends, not on the next poll.
    const { onChange, rendered } = renderChangeHook(false);
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    rendered.rerender({ enabled: false });
    expect(onChange).not.toHaveBeenCalled();
    rendered.rerender({ enabled: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    rendered.rerender({ enabled: true });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('collapses several changes while disabled into one delivery', () => {
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-a' };
    const { onChange, rendered } = renderChangeHook(false);
    mockState.prime = { isLoggedIn: false, onekeyUserId: undefined };
    rendered.rerender({ enabled: false });
    mockState.prime = { isLoggedIn: true, onekeyUserId: 'user-b' };
    rendered.rerender({ enabled: false });
    rendered.rerender({ enabled: true });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not fire on re-enable without an identity change', () => {
    const { onChange, rendered } = renderChangeHook(false);
    rendered.rerender({ enabled: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});
