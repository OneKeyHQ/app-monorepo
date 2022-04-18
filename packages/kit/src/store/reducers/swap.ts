import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Token } from '../typings';

type SwapState = {
  input?: Token;
  output?: Token;
  inputAmount: string;
  outputAmount: string;
  independentField: 'INPUT' | 'OUTPUT';
  value: number;
};

const initialState: SwapState = {
  input: undefined,
  output: undefined,
  inputAmount: '',
  outputAmount: '',
  independentField: 'INPUT',
  value: 0,
};

export const swapSlice = createSlice({
  name: 'swap',
  initialState,
  reducers: {
    setInput(state, action: PayloadAction<Token>) {
      state.input = action.payload;
    },
    setInputAmount(state, action: PayloadAction<string>) {
      state.inputAmount = action.payload;
    },
    setOutput(state, action: PayloadAction<Token>) {
      state.output = action.payload;
    },
    setOutputAmount(state, action: PayloadAction<string>) {
      state.outputAmount = action.payload;
    },
    setIndependentField(state, action: PayloadAction<'INPUT' | 'OUTPUT'>) {
      state.independentField = action.payload;
    },
    update(state) {
      state.value += 1;
    },
    switchInputOutput(state) {
      const { output } = state;
      const { outputAmount } = state;
      state.output = state.input;
      state.outputAmount = state.inputAmount;
      state.input = output;
      state.inputAmount = outputAmount;
    },
    reset(state) {
      state.output = undefined;
      state.outputAmount = '';
      state.input = undefined;
      state.inputAmount = '';
      state.independentField = 'INPUT';
    },
  },
});

export const {
  setInput,
  setOutput,
  setInputAmount,
  setOutputAmount,
  setIndependentField,
  update,
  switchInputOutput,
  reset,
} = swapSlice.actions;

export default swapSlice.reducer;
