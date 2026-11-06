import { fetch as expoFetch } from 'expo/fetch';

// Host response streaming uses the existing Expo API instead of buffered RN fetch.
export const streamingFetch: typeof fetch = (input, init) =>
  expoFetch(String(input), init);
