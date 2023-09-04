/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
/* eslint-disable import/order */
import '@onekeyhq/shared/src/polyfills';

import { lazy, useEffect, useState } from 'react';

import { HashRouter, Route, Routes } from 'react-router-dom';

import Provider from '@onekeyhq/components/src/Provider';
import LOCALES from '@onekeyhq/components/src/locale';
// css should be imported at last
import '@onekeyhq/shared/src/web/index.css';

import type { LocaleSymbol } from '@onekeyhq/components/src/locale';

const LazyOnboardingAutoTyping = lazy(
  () => import('./views/OnboardingAutoTyping'),
);
const LazyWebEmbedApiWebPage = lazy(() => import('./views/WebEmbedApiWebPage'));

// @ts-ignore
const appSettings = window.WEB_EMBED_ONEKEY_APP_SETTINGS || {
  themeVariant: 'light',
  localeVariant: 'en-US',
  enableHaptics: true,
};
const localeVariant = appSettings.localeVariant as LocaleSymbol;
const cachedLocale = LOCALES[localeVariant];

function HomePage() {
  return (
    <>
      <LazyOnboardingAutoTyping />
      <LazyWebEmbedApiWebPage showContent={false} />
    </>
  );
}

function App() {
  const [localeReady, setLocaleReady] = useState(
    typeof cachedLocale !== 'function',
  );
  useEffect(() => {
    if (typeof cachedLocale === 'function') {
      cachedLocale().then((module) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        LOCALES[localeVariant] = module.default;
        setLocaleReady(true);
      });
    }
  }, []);
  return localeReady ? (
    <Provider
      themeVariant={appSettings.themeVariant}
      locale={appSettings.localeVariant}
      waitFontLoaded={false}
    >
      <HashRouter>
        <Routes>
          {/* jian guo pro3 NOT support hash route init */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/onboarding/auto_typing"
            element={<LazyOnboardingAutoTyping />}
          />
          {/* http://localhost:3008/#/webembed_api */}
          <Route path="/webembed_api" element={<LazyWebEmbedApiWebPage />} />
        </Routes>
      </HashRouter>
    </Provider>
  ) : null;
}

export default App;
