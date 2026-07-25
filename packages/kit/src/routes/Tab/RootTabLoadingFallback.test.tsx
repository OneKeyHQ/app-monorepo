/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { RootTabLoadingFallback } from './RootTabLoadingFallback';

declare global {
  // eslint-disable-next-line no-var
  var __rootTabLoadingFallbackMedia: { md: boolean };
  // eslint-disable-next-line no-var
  var __rootTabLoadingFallbackPlatformEnv: { isNative: boolean };
}

jest.mock('@onekeyhq/components', () => ({
  Page: {
    Header: () => <div data-testid="page-header" />,
  },
  Spinner: () => <div data-testid="loading-spinner" />,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMedia: () => globalThis.__rootTabLoadingFallbackMedia,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const platformEnv = { isNative: false };
  globalThis.__rootTabLoadingFallbackPlatformEnv = platformEnv;
  return {
    __esModule: true,
    default: platformEnv,
  };
});

jest.mock('../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../../components/TabPageHeader', () => ({
  TabPageHeader: () => <div data-testid="tab-page-header" />,
}));

const marketTabRoute = 'Market' as ETabRoutes;

beforeEach(() => {
  globalThis.__rootTabLoadingFallbackMedia = { md: false };
  globalThis.__rootTabLoadingFallbackPlatformEnv.isNative = false;
});

describe('RootTabLoadingFallback', () => {
  it('keeps the web header and route-specific chrome mounted on small screens', () => {
    globalThis.__rootTabLoadingFallbackMedia = { md: true };

    render(
      <RootTabLoadingFallback
        tabRoute={marketTabRoute}
        mobileContentFallback={<div data-testid="mobile-content-fallback" />}
      />,
    );

    expect(screen.getByTestId('mobile-content-fallback')).toBeTruthy();
    expect(screen.getByTestId('tab-page-header')).toBeTruthy();
    expect(screen.queryByTestId('loading-spinner')).toBeNull();
    expect(screen.queryByTestId('page-header')).toBeNull();
  });

  it('uses the neutral spinner on native', () => {
    globalThis.__rootTabLoadingFallbackMedia = { md: true };
    globalThis.__rootTabLoadingFallbackPlatformEnv.isNative = true;

    render(
      <RootTabLoadingFallback
        tabRoute={marketTabRoute}
        mobileContentFallback={<div data-testid="mobile-content-fallback" />}
      />,
    );

    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    expect(screen.queryByTestId('mobile-content-fallback')).toBeNull();
    expect(screen.queryByTestId('tab-page-header')).toBeNull();
  });

  it('preserves the neutral fallback for small web routes without custom chrome', () => {
    globalThis.__rootTabLoadingFallbackMedia = { md: true };

    render(<RootTabLoadingFallback tabRoute={marketTabRoute} />);

    expect(screen.getByTestId('page-header')).toBeTruthy();
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    expect(screen.queryByTestId('tab-page-header')).toBeNull();
  });

  it('preserves the desktop tab page header on wide web screens', () => {
    render(
      <RootTabLoadingFallback
        tabRoute={marketTabRoute}
        mobileContentFallback={<div data-testid="mobile-content-fallback" />}
      />,
    );

    expect(screen.getByTestId('tab-page-header')).toBeTruthy();
    expect(screen.getByTestId('loading-spinner')).toBeTruthy();
    expect(screen.queryByTestId('mobile-content-fallback')).toBeNull();
  });
});
