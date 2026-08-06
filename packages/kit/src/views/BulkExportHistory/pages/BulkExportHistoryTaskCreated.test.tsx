/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import BulkExportHistoryTaskCreated from './BulkExportHistoryTaskCreated';

jest.mock('@react-navigation/native', () => ({
  StackActions: {
    replace: jest.fn(),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const Container = ({ children }: { children?: import('react').ReactNode }) =>
    React.createElement('div', null, children);
  const Page = Object.assign(Container, {
    Header: ({ title }: { title: string }) =>
      React.createElement('span', null, title),
    Body: Container,
    Footer: Container,
    FooterActions: ({
      onCancelText,
      onConfirmText,
    }: {
      onCancelText: string;
      onConfirmText: string;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'span',
          { 'data-testid': 'cancel-label' },
          onCancelText,
        ),
        React.createElement(
          'span',
          { 'data-testid': 'confirm-label' },
          onConfirmText,
        ),
      ),
  });

  return {
    Alert: Container,
    LottieView: Container,
    Page,
    SizableText: Container,
    Stack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    dispatch: jest.fn(),
    popStack: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: true,
    run: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/utils/notificationPermissionUtils', () => ({
  enableNotificationsBestEffort: jest.fn(),
  isNotificationFullyEnabled: jest.fn(),
}));

describe('BulkExportHistoryTaskCreated', () => {
  it('uses the dedicated concise history action for the secondary button', () => {
    const { getByTestId, queryByText } = render(
      <BulkExportHistoryTaskCreated />,
    );

    expect(getByTestId('cancel-label').textContent).toBe(
      ETranslations.export_history__action,
    );
    expect(queryByText(ETranslations.view_export_history__action)).toBeNull();
  });
});
