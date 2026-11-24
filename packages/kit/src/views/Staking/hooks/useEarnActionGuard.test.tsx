/** @jest-environment jsdom */

import { Suspense, startTransition, useState } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import { useEarnActionGuard } from './useEarnActionGuard';

import type { IEarnActionGuard, IEarnFooterAction } from './useEarnActionGuard';

describe('Earn action guard', () => {
  const onPress = jest.fn();
  const action: IEarnFooterAction = { text: 'Continue', onPress };

  beforeEach(() => jest.clearAllMocks());

  it('keeps an unguarded action synchronous', () => {
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, identity: 'account-a' }),
    );
    act(() => result.current.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not continue after the action identity changes and changes back', async () => {
    let finish: (result: boolean) => void = () => undefined;
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    };
    const { result, rerender } = renderHook(
      ({ identity }) => useEarnActionGuard({ action, guard, identity }),
      { initialProps: { identity: 'account-a' } },
    );

    act(() => result.current.onPress());
    rerender({ identity: 'account-b' });
    rerender({ identity: 'account-a' });
    await act(async () => finish(true));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('continues verification when another identity render is abandoned', async () => {
    let finish: (result: boolean) => void = () => undefined;
    let suspendedRenders = 0;
    const suspended = new Promise<never>(() => undefined);
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    };

    function Form({ identity }: { identity: string }) {
      const guarded = useEarnActionGuard({ action, guard, identity });
      if (identity === 'account-b') {
        suspendedRenders += 1;
        throw suspended;
      }
      return (
        <button type="button" onClick={guarded.onPress}>
          Continue
        </button>
      );
    }

    function App() {
      const [identity, setIdentity] = useState('account-a');
      return (
        <>
          <button
            type="button"
            onClick={() => startTransition(() => setIdentity('account-b'))}
          >
            Start transition
          </button>
          <button type="button" onClick={() => setIdentity('account-a')}>
            Abandon transition
          </button>
          <Suspense fallback={<span>Loading</span>}>
            <Form identity={identity} />
          </Suspense>
        </>
      );
    }

    render(<App />);
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Start transition'));
    expect(suspendedRenders).toBeGreaterThan(0);
    expect(screen.getByText('Continue')).toBeTruthy();
    fireEvent.click(screen.getByText('Abandon transition'));
    await act(async () => finish(true));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the committed disabled state while a same-identity render is abandoned', async () => {
    let finish: (result: boolean) => void = () => undefined;
    let suspendedRenders = 0;
    const suspended = new Promise<never>(() => undefined);
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: jest.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      ),
    };

    function Form({
      disabled,
      suspend,
    }: {
      disabled: boolean;
      suspend: boolean;
    }) {
      const guarded = useEarnActionGuard({
        action: { ...action, disabled },
        guard,
        identity: 'account-a',
      });
      if (suspend) {
        suspendedRenders += 1;
        throw suspended;
      }
      return (
        <button
          type="button"
          disabled={guarded.disabled}
          onClick={guarded.onPress}
        >
          Continue
        </button>
      );
    }

    function App() {
      const [view, setView] = useState({ disabled: false, suspend: false });
      return (
        <>
          <button
            type="button"
            onClick={() => setView({ disabled: true, suspend: false })}
          >
            Disable
          </button>
          <button
            type="button"
            onClick={() =>
              startTransition(() => setView({ disabled: false, suspend: true }))
            }
          >
            Start transition
          </button>
          <button
            type="button"
            onClick={() => setView({ disabled: true, suspend: false })}
          >
            Abandon transition
          </button>
          <Suspense fallback={<span>Loading</span>}>
            <Form {...view} />
          </Suspense>
        </>
      );
    }

    render(<App />);
    fireEvent.click(screen.getByText('Continue'));
    expect(guard.verifyBeforeAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Disable'));
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByText('Start transition'));
    expect(suspendedRenders).toBeGreaterThan(0);
    await act(async () => finish(true));
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Abandon transition'));
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('continues only when the guard succeeds for the current action', async () => {
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: jest.fn().mockResolvedValue(true),
    };
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, guard, identity: 'account-a' }),
    );
    await act(async () => result.current.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not continue when verification fails', async () => {
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: true,
      verifyBeforeAction: jest.fn().mockResolvedValue(false),
    };
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, guard, identity: 'account-a' }),
    );
    await act(async () => result.current.onPress());
    expect(onPress).not.toHaveBeenCalled();
    expect(result.current.disabled).toBe(true);
  });

  it('does not continue if the synchronous guard becomes blocked while verification is pending', async () => {
    let finish: (result: boolean) => void = () => undefined;
    let allowed = true;
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
      isActionAllowed: () => allowed,
    };
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, guard, identity: 'account-a' }),
    );

    act(() => result.current.onPress());
    allowed = false;
    await act(async () => finish(true));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not continue after the form unmounts', async () => {
    let finish: (result: boolean) => void = () => undefined;
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    };
    const { result, unmount } = renderHook(() =>
      useEarnActionGuard({ action, guard, identity: 'account-a' }),
    );
    act(() => result.current.onPress());
    unmount();
    await act(async () => finish(true));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not continue when the form becomes disabled while verifying', async () => {
    let finish: (result: boolean) => void = () => undefined;
    const guard: IEarnActionGuard = {
      loading: false,
      blocked: false,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    };
    const { result, rerender } = renderHook(
      ({ disabled }) =>
        useEarnActionGuard({
          action: { ...action, disabled },
          guard,
          identity: 'account-a',
        }),
      { initialProps: { disabled: false } },
    );
    act(() => result.current.onPress());
    rerender({ disabled: true });
    await act(async () => finish(true));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('preserves the existing footer override before the guard', () => {
    const override = { text: 'Retry', onPress: jest.fn() };
    const guard: IEarnActionGuard = {
      loading: true,
      blocked: true,
      verifyBeforeAction: jest.fn().mockResolvedValue(false),
    };
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, override, guard, identity: 'account-a' }),
    );
    act(() => result.current.onPress());
    expect(override.onPress).toHaveBeenCalledTimes(1);
    expect(guard.verifyBeforeAction).not.toHaveBeenCalled();
    expect(result.current.disabled).toBeUndefined();
  });

  it('uses the guard action while a prerequisite needs user action', () => {
    const resolvePrerequisite = jest.fn();
    const guard: IEarnActionGuard = {
      action: { text: 'Resolve', onPress: resolvePrerequisite },
      loading: false,
      blocked: true,
      verifyBeforeAction: jest.fn().mockResolvedValue(false),
    };
    const { result } = renderHook(() =>
      useEarnActionGuard({ action, guard, identity: 'account-a' }),
    );
    expect(result.current.text).toBe('Resolve');
    act(() => result.current.onPress());
    expect(resolvePrerequisite).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
