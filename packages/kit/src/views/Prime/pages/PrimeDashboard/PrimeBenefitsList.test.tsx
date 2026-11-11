/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { IntlProvider, createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  LOCALE_KEYS,
  loadLocaleMessages,
} from '@onekeyhq/shared/src/locale/localeLoaders';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale/type';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { getPrimeFeatureIntro } from '../PrimeFeatures/primeFeatureIntroUtils';

import { PrimeBenefitsItem } from './PrimeBenefitsList';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', undefined, children);
  return {
    Badge: Object.assign(Container, { Text: Container }),
    Icon: () => null,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    YStack: Container,
    Toast: { success: jest.fn() },
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ListItem: Object.assign(
      ({ children }: { children?: ReactNode }) =>
        React.createElement('div', undefined, children),
      {
        Text: ({
          primary,
          secondary,
        }: {
          primary?: ReactNode;
          secondary?: ReactNode;
        }) => React.createElement('div', undefined, primary, secondary),
      },
    ),
  };
});
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ isPrimeActive: true }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));
jest.mock('../PrimeFeatures/PrimeFeatureIntroContent', () => ({
  showPrimeFeatureIntroDialog: jest.fn(),
}));

describe('PrimeBenefitsItem shared by dashboard and gift benefits', () => {
  it.each([
    ['en', 'App only'],
    ['zh-CN', '仅限 App'],
  ])('renders the bundled app-only label in %s', async (locale, label) => {
    const messages = await loadLocaleMessages(locale as ILocaleJSONSymbol);
    const feature = getPrimeFeatureIntro(EPrimeFeatures.DAppTranslate);
    expect(feature).toBeDefined();
    if (!feature) {
      return;
    }
    render(
      <IntlProvider locale={locale} messages={messages}>
        <PrimeBenefitsItem feature={{ ...feature, isAppOnly: true }} />
      </IntlProvider>,
    );
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('formats the Chinese availability statuses from the loaded locale', async () => {
    const messages = await loadLocaleMessages('zh-CN');
    const onError = jest.fn();
    const intl = createIntl({ locale: 'zh-CN', messages, onError });
    expect(
      intl.formatMessage({ id: ETranslations.prime_available_in_app__title }),
    ).toBe('可在 App 中使用');
    expect(
      intl.formatMessage({ id: ETranslations.prime_always_on__title }),
    ).toBe('始终生效');
    expect(onError).not.toHaveBeenCalled();
  });

  it('ships all three availability labels in every loaded locale', async () => {
    for (const locale of LOCALE_KEYS) {
      const messages = await loadLocaleMessages(locale);
      for (const key of [
        ETranslations.prime_app_only__title,
        ETranslations.prime_available_in_app__title,
        ETranslations.prime_always_on__title,
      ]) {
        expect(messages[key]?.trim()).toBeTruthy();
      }
    }
  });

  it('does not add a label to other platforms or security benefits', async () => {
    const messages = await loadLocaleMessages('en');
    const feature = getPrimeFeatureIntro(EPrimeFeatures.BlockaidSiteScan);
    expect(feature).toBeDefined();
    if (!feature) {
      return;
    }
    render(
      <IntlProvider locale="en" messages={messages}>
        <PrimeBenefitsItem feature={{ ...feature, isAppOnly: false }} />
      </IntlProvider>,
    );
    expect(screen.queryByText('App only')).toBeNull();
  });
});
