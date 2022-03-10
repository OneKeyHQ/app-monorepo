/* eslint-disable import/first */
import 'react-native-url-polyfill/auto';

export { FormattedMessage } from 'react-intl';
export { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
export type { PayloadAction } from '@reduxjs/toolkit';

// import backgroundApiProxy after third party modules, but before all local modules
import backgroundApiProxy from './background/instance/backgroundApiProxy';

if (process.env.NODE_ENV !== 'production') {
  console.log('backgroundApiProxy should init ASAP:', backgroundApiProxy);
}

export { default as Provider } from './provider';
export { default as useNavigation } from './hooks/useNavigation';
