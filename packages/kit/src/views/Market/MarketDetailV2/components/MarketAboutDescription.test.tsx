/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketAboutDescription } from './MarketAboutDescription';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const YStack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const SizableText = ({
    children,
    numberOfLines,
    testID,
  }: {
    children?: ReactNode;
    numberOfLines?: number;
    testID?: string;
  }) => (
    <p data-testid={testID} data-number-of-lines={numberOfLines ?? 'none'}>
      {children}
    </p>
  );
  const Button = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  );

  return { Button, SizableText, YStack };
});

const LONG_DESCRIPTION =
  'Ethereum is a global, open-source platform for decentralized apps. '.repeat(
    6,
  );

describe('MarketAboutDescription', () => {
  it('collapses a long description to two lines until expanded', () => {
    render(
      <MarketAboutDescription
        description={LONG_DESCRIPTION}
        testID="about"
        toggleTestID="about-toggle"
      />,
    );

    expect(
      screen.getByTestId('about').getAttribute('data-number-of-lines'),
    ).toBe('2');
    expect(screen.getByTestId('about-toggle').textContent).toBe(
      ETranslations.global_show_more,
    );

    fireEvent.click(screen.getByTestId('about-toggle'));

    expect(
      screen.getByTestId('about').getAttribute('data-number-of-lines'),
    ).toBe('none');
    expect(screen.getByTestId('about-toggle').textContent).toBe(
      ETranslations.global_show_less,
    );
  });

  it('renders a short description in full without a toggle', () => {
    render(
      <MarketAboutDescription
        description="Short."
        testID="about"
        toggleTestID="about-toggle"
      />,
    );

    expect(
      screen.getByTestId('about').getAttribute('data-number-of-lines'),
    ).toBe('none');
    expect(screen.queryByTestId('about-toggle')).toBeNull();
  });
});
