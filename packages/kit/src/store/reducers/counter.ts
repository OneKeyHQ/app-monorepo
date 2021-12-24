import { createSlice } from '@reduxjs/toolkit';
import { Dispatch } from 'redux';

import type { IAppState } from '../index';

export const slice = createSlice({
  name: 'counter',
  initialState: {
    value: 1024,
  },
  reducers: {
    increment: (state) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    },
  },
});

export const { increment, decrement, incrementByAmount } = slice.actions;

// The function below is called a thunk and allows us to perform async logic. It
// can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// will call the thunk with the `dispatch` function as the first argument. Async
// code can then be executed and other actions can be dispatched
export const incrementAsync = (amount: number) => async (dispatch: Dispatch) =>
  new Promise((resolve) => {
    setTimeout(() => {
      dispatch(incrementByAmount(amount));
      resolve(true);
    }, 1000);
  });

// The function below is called a selector and allows us to select a value from
// the state. Selectors can also be defined inline where they're used instead of
// in the slice file. For example: `useSelector((state) => state.counter.value)`
export const selectCount = (state: IAppState): number => state.counter.value;

export default slice.reducer;
