/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import {
  SwapStockDesktopContainer,
  SwapStockMobileContainer,
} from './SwapStockContainerLazy';

const mockStockModuleEvaluation = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Spinner: () => <div data-testid="stock-loading-spinner" />,
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'ERROR', Warning: 'WARNING' },
    NativeLogger: { write: jest.fn() },
  }),
);

jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => jest.fn(),
}));

jest.mock('./SwapStockDesktopContainer', () => {
  mockStockModuleEvaluation();
  return {
    SwapStockDesktopContainer: () => (
      <div data-testid="stock-desktop-content" />
    ),
    SwapStockMobileContainer: () => <div data-testid="stock-mobile-content" />,
  };
});

describe('SwapStockContainerLazy', () => {
  it('keeps the Stock module unevaluated until a Stock surface renders', async () => {
    expect(mockStockModuleEvaluation).not.toHaveBeenCalled();

    const mobile = render(
      <SwapStockMobileContainer
        {...({} as ComponentProps<typeof SwapStockMobileContainer>)}
      />,
    );

    expect(screen.queryByTestId('SwapStockContainerLoading')).not.toBeNull();
    await waitFor(() => {
      expect(screen.queryByTestId('stock-mobile-content')).not.toBeNull();
    });
    expect(mockStockModuleEvaluation).toHaveBeenCalledTimes(1);

    mobile.unmount();
    render(
      <SwapStockDesktopContainer
        {...({} as ComponentProps<typeof SwapStockDesktopContainer>)}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('stock-desktop-content')).not.toBeNull();
    });
    expect(mockStockModuleEvaluation).toHaveBeenCalledTimes(1);
  });
});
