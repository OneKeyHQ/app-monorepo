/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';

import { PrimeGiftClaimContent } from './PrimeGiftViews';

const mockCopyText = jest.fn();
const messages: Record<string, string> = enMessages;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  function Container({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return React.createElement('div', { 'data-testid': testID }, children);
  }
  return {
    Alert: ({
      title,
      description,
      testID,
    }: {
      title?: ReactNode;
      description?: ReactNode;
      testID?: string;
    }) =>
      React.createElement('div', { 'data-testid': testID }, title, description),
    Button: ({
      children,
      onPress,
      testID,
      'aria-expanded': ariaExpanded,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
      'aria-expanded'?: boolean;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          onClick: onPress,
          type: 'button',
          'aria-expanded': ariaExpanded,
        },
        children,
      ),
    Dialog: { show: jest.fn() },
    Icon: () => null,
    LottieView: () => null,
    Page: Object.assign(Container, {
      Footer: Container,
      FooterActions: Container,
    }),
    ScrollView: Container,
    SizableText: ({
      children,
      testID,
    }: {
      children?: ReactNode;
      testID?: string;
    }) => React.createElement('span', { 'data-testid': testID }, children),
    Stack: Container,
    XStack: Container,
    YStack: Container,
    useClipboard: () => ({ copyText: mockCopyText }),
    useThemeName: () => 'light',
  };
});

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ListItem: ({
      children,
      subtitle,
      testID,
      title,
    }: {
      children?: ReactNode;
      subtitle?: ReactNode;
      testID?: string;
      title?: ReactNode;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID },
        title,
        subtitle,
        children,
      ),
  };
});

jest.mock('../pages/PrimeDashboard/PrimeBenefitsList', () => ({
  PrimeBenefitsItem: () => null,
}));
jest.mock('../pages/PrimeFeatures/primeFeatureIntroUtils', () => ({
  PRIME_FEATURE_INTROS: [],
}));
jest.mock('./PrimeDarkDialogContainer', () => ({
  PrimeDarkDialogContainer: () => null,
}));
jest.mock('./PrimeGiftCampaignBanner', () => ({
  PrimeGiftCampaignBanner: () => null,
}));

function renderContent(
  props: Partial<Parameters<typeof PrimeGiftClaimContent>[0]> = {},
) {
  const onViewCode = jest.fn();
  const onCopyCode = jest.fn();
  const view = render(
    <IntlProvider locale="en" messages={messages}>
      <PrimeGiftClaimContent
        deviceModelName="OneKey Pro 2"
        eligibilityStatus="Redemption code received"
        isEligible
        isAccountReady
        isDeviceVerified
        accountName="ada@example.com"
        giftMonths={6}
        onViewCode={onViewCode}
        onCopyCode={onCopyCode}
        {...props}
      />
    </IntlProvider>,
  );
  return { ...view, onViewCode, onCopyCode };
}

describe('PrimeGiftClaimContent redemption code', () => {
  beforeEach(() => {
    mockCopyText.mockClear();
  });

  it('keeps the code collapsed until viewed, copies it, and stays open', () => {
    const { rerender, onViewCode, onCopyCode } = renderContent({
      redemptionCode: undefined,
      isEligible: false,
      isDeviceVerified: false,
      eligibilityStatus: 'Confirmed after device verification',
    });
    expect(screen.queryByTestId('prime-gift-view-code')).toBeNull();
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <PrimeGiftClaimContent
          deviceModelName="OneKey Pro 2"
          eligibilityStatus="Redemption code received"
          isEligible
          isAccountReady
          isDeviceVerified
          accountName="ada@example.com"
          giftMonths={6}
          redemptionCode="OKP-GIFT-CODE"
          onViewCode={onViewCode}
          onCopyCode={onCopyCode}
        />
      </IntlProvider>,
    );
    const toggle = screen.getByTestId('prime-gift-view-code');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('prime-gift-redemption-code')).toBeNull();
    fireEvent.click(toggle);
    expect(
      screen.getByTestId('prime-gift-view-code').getAttribute('aria-expanded'),
    ).toBe('true');
    expect(screen.getByTestId('prime-gift-redemption-code').textContent).toBe(
      'OKP-GIFT-CODE',
    );
    expect(onViewCode).toHaveBeenCalledTimes(1);
    expect(onViewCode.mock.calls[0]).toEqual([]);

    fireEvent.click(screen.getByTestId('prime-gift-copy-code'));
    expect(mockCopyText).toHaveBeenCalledWith('OKP-GIFT-CODE');
    expect(onCopyCode).toHaveBeenCalledTimes(1);
    expect(onCopyCode.mock.calls[0]).toEqual([]);
    expect(screen.getByTestId('prime-gift-redemption-code').textContent).toBe(
      'OKP-GIFT-CODE',
    );
    expect(
      screen.getByTestId('prime-gift-view-code').getAttribute('aria-expanded'),
    ).toBe('true');

    fireEvent.click(screen.getByTestId('prime-gift-view-code'));
    expect(screen.queryByTestId('prime-gift-redemption-code')).toBeNull();
    expect(
      screen.getByTestId('prime-gift-view-code').getAttribute('aria-expanded'),
    ).toBe('false');
    expect(onViewCode).toHaveBeenCalledTimes(1);
  });
});
