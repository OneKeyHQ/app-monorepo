/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/SignatureConfirm/hooks/useOneKeyIdIdentityChange.test.tsx

OK-64746: a Gas Account quote is bound to the OneKey ID member it was
estimated for, and Prime rejects the send when the identity changed in
between. The confirm page therefore re-estimates when the login state or the
member changes while it is open — but not on mount, and not when the same
member merely refreshes its token.
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
    const rendered = renderHook(() =>
      useOneKeyIdIdentityChange({ enabled, onChange }),
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
    rendered.rerender();
    expect(onChange).not.toHaveBeenCalled();
  });
});
