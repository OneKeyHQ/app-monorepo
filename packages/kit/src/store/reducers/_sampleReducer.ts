import { PayloadAction, createSlice } from '@reduxjs/toolkit';

// rename all `sample` string

export type SampleInitialState = {
  name: string;
};

const initialState: SampleInitialState = {
  name: '',
};

export const sampleSlicer = createSlice({
  name: 'sample',
  initialState,
  reducers: {
    updateSampleName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
    },
  },
});

export const { updateSampleName } = sampleSlicer.actions;

export default sampleSlicer.reducer;
