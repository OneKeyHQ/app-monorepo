/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
/* eslint-disable import/order */
import '@onekeyhq/shared/src/polyfills';

import { lazy, useEffect, useState } from 'react';

import { HashRouter, Link, Route, Routes } from 'react-router-dom';

import { Provider } from '@onekeyhq/components';
import type { LocaleSymbol } from '@onekeyhq/components/src/locale';
import LOCALES from '@onekeyhq/components/src/locale';
// css should be imported at last
import '@onekeyhq/shared/src/web/index.css';

const LazyOnboardingAutoTyping = lazy(
  () => import('./src/views/OnboardingAutoTyping'),
);
const LazyWebEmbedApiScreen = lazy(
  () => import('./src/views/WebEmbedApiScreen'),
);

function HomeAbcTest() {
  return (
    <div>
      ABC
      <div>
        <Link to="/">Back home</Link>
      </div>
    </div>
  );
}

// @ts-ignore
const appSettings = window.WEB_EMBED_ONEKEY_APP_SETTINGS || {
  themeVariant: 'light',
  localeVariant: 'en-US',
  enableHaptics: true,
};
const localeVariant = appSettings.localeVariant as LocaleSymbol;
const cachedLocale = LOCALES[localeVariant];

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
          {/* TODO jian guo pro3 NOT support hash route init */}
          <Route path="/" element={<LazyOnboardingAutoTyping />} />
          <Route path="/abc" element={<HomeAbcTest />} />
          <Route
            path="/onboarding/auto_typing"
            element={<LazyOnboardingAutoTyping />}
          />
          {/* TODO also move to OnboardingAutoTyping */}
          <Route path="/webembed_api" element={<LazyWebEmbedApiScreen />} />
        </Routes>
      </HashRouter>
    </Provider>
  ) : null;
}

export default App;
