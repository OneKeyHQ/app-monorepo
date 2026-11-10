/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { getPrimeFeatureIntro } from '../PrimeFeatures/primeFeatureIntroUtils';

import { PrimeBenefitsItem } from './PrimeBenefitsList';

const getMessages = (appOnlyLabel: string): Record<string, string> => ({
  ...enMessages,
  ...Object.fromEntries<string>(
    Object.values(ETranslationsMock).map(
      (messageId) => [messageId, messageId] as const,
    ),
  ),
  [ETranslationsMock.prime_app_only__title]: appOnlyLabel,
});

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
  ])('renders the localized app-only label in %s', (locale, label) => {
    const feature = getPrimeFeatureIntro(EPrimeFeatures.DAppTranslate);
    expect(feature).toBeDefined();
    if (!feature) {
      return;
    }
    render(
      <IntlProvider locale={locale} messages={getMessages(label)}>
        <PrimeBenefitsItem feature={{ ...feature, isAppOnly: true }} />
      </IntlProvider>,
    );
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('does not add a label to other platforms or security benefits', () => {
    const feature = getPrimeFeatureIntro(EPrimeFeatures.BlockaidSiteScan);
    expect(feature).toBeDefined();
    if (!feature) {
      return;
    }
    render(
      <IntlProvider locale="en" messages={getMessages('App only')}>
        <PrimeBenefitsItem feature={{ ...feature, isAppOnly: false }} />
      </IntlProvider>,
    );
    expect(screen.queryByText('App only')).toBeNull();
  });
});
