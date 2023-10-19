import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '../index';

export const themeProviderSelector = createSelector(
  [
    (s: IAppState) => s.settings.theme,
    (s: IAppState) => s.settings.locale,
    (s: IAppState) => s.settings.lastLocale,
  ],
  (theme, locale, lastLocale) => ({
    theme,
    locale,
    lastLocale,
  }),
);
