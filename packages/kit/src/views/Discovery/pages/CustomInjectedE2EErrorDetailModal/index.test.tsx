/** @jest-environment jsdom */

import CustomInjectedE2EErrorDetailModal from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setStringAsync } from 'expo-clipboard';

const mockErrorLog = [
  'OneKey Desktop E2E validation',
  'Exit code: 4',
  '--- stderr ---',
  ...Array.from({ length: 100 }, (_, index) => `failure line ${index + 1}`),
].join('\n');

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      errorLog: mockErrorLog,
      protocolName: 'SSV Network',
    },
  }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    children,
    testID,
    title,
  }: {
    children?: React.ReactNode;
    testID?: string;
    title?: React.ReactNode;
  }) => React.createElement('div', { 'data-testid': testID }, title, children);
  const Page = Object.assign(Container, {
    Body: Container,
    Header: Container,
  });

  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': testID,
          onClick: onPress,
          type: 'button',
        },
        children,
      ),
    Page,
    ScrollView: Container,
    SizableText: Container,
    Toast: {
      error: jest.fn(),
      success: jest.fn(),
    },
    XStack: Container,
    YStack: Container,
  };
});

describe('CustomInjectedE2EErrorDetailModal', () => {
  test('shows a scrollable log view and copies the complete error log', async () => {
    render(<CustomInjectedE2EErrorDetailModal />);

    expect(screen.getByText('E2E error details')).not.toBeNull();
    expect(screen.getByText('SSV Network')).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-error-log-scroll'),
    ).not.toBeNull();
    expect(
      screen.getByTestId('custom-injected-e2e-error-log').textContent,
    ).toContain('failure line 100');

    fireEvent.click(screen.getByTestId('custom-injected-e2e-copy-error'));
    await waitFor(() =>
      expect(setStringAsync).toHaveBeenCalledWith(mockErrorLog),
    );
  });
});
