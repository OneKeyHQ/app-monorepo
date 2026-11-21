import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskStore } from './createEarnTaskStore';

type IState = { count: number };
type IEvent = { type: 'add'; amount: number } | { type: 'reject' };

function createStore() {
  return createEarnTaskStore<IState, IEvent>({
    initialState: { count: 0 },
    reduce: (state, event) => {
      if (event.type === 'reject' || event.amount === 0) return state;
      return { count: state.count + event.amount };
    },
  });
}

it('applies a valid batch atomically and notifies only once', () => {
  const store = createStore();
  const listener = jest.fn(() => store.getState().count);
  store.subscribe(listener);
  expect(
    store.dispatchBatch([
      { type: 'add', amount: 2 },
      { type: 'add', amount: 3 },
    ]),
  ).toBe(true);
  expect(store.getState()).toEqual({ count: 5 });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveReturnedWith(5);
});

it('does not apply any part of a rejected batch or notify', () => {
  const store = createStore();
  const initial = store.getState();
  const listener = jest.fn();
  store.subscribe(listener);
  expect(store.dispatchBatch([])).toBe(false);
  expect(
    store.dispatchBatch([{ type: 'add', amount: 1 }, { type: 'reject' }]),
  ).toBe(false);
  expect(store.dispatch({ type: 'add', amount: 0 })).toBe(false);
  expect(store.getState()).toBe(initial);
  expect(listener).not.toHaveBeenCalled();
});

it('does not publish a partial batch if the reducer throws', () => {
  const store = createEarnTaskStore({
    initialState: 0,
    reduce: (state: number, event: number) => {
      if (event < 0) throw new OneKeyLocalError('invalid event');
      return state + event;
    },
  });
  const listener = jest.fn();
  store.subscribe(listener);
  expect(() => store.dispatchBatch([1, -1])).toThrow('invalid event');
  expect(store.getState()).toBe(0);
  expect(listener).not.toHaveBeenCalled();
});

it('keeps execution ownership until the same owner releases it', () => {
  const store = createStore();
  const first = Symbol('first');
  const second = Symbol('second');
  expect(store.acquire(first)).toBe(true);
  expect(store.acquire(first)).toBe(true);
  expect(store.acquire(second)).toBe(false);
  store.release(second);
  expect(store.owns(first)).toBe(true);
  store.release(first);
  expect(store.owns(first)).toBe(false);
  expect(store.acquire(second)).toBe(true);
});

it('returns controlled update results and notifies only on a changed state', () => {
  const store = createStore();
  const listener = jest.fn();
  const unsubscribe = store.subscribe(listener);
  expect(store.update((state) => ({ state, result: 'rejected' }))).toBe(
    'rejected',
  );
  expect(listener).not.toHaveBeenCalled();
  expect(
    store.update((state) => ({
      state: { count: state.count + 1 },
      result: 'accepted',
    })),
  ).toBe('accepted');
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  store.dispatch({ type: 'add', amount: 1 });
  expect(listener).toHaveBeenCalledTimes(1);
});
