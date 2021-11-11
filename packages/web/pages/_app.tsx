import React from 'react';
import type { AppProps } from 'next/app';
import { Provider } from '@onekeyhq/kit';

export default function MyApp({ Component, pageProps }: AppProps) {
  const language = 'en';
  return (
    <Provider language={language}>
      <Component {...pageProps} />
    </Provider>
  );
}
