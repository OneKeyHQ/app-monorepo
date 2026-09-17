/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { TokenIdentityItem } from './TokenIdentityItem';

// Jest maps every `@onekeyhq/components` path, subpaths included, to one mock
// module, so the lazy overlays must live in this single factory.
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  NATIVE_HIT_SLOP: undefined,
  NumberSizeableText: ({
    children,
    size,
  }: PropsWithChildren<{ size?: string }>) => (
    <span data-testid="volume-number" data-size={size}>
      {children}
    </span>
  ),
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useClipboard: () => ({ copyText: jest.fn() }),
  useMedia: () => ({ gtMd: false }),
  LazyTooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => (
    <>{renderTrigger}</>
  ),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge',
  () => ({ CommunityRecognizedBadge: () => null }),
);

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  StockSourceLogo: () => null,
  SubtitleText: ({ subtitle }: { subtitle: string }) => <span>{subtitle}</span>,
  getSubtitleTextSize: (gtMd: boolean) => (gtMd ? '$bodyXs' : '$bodySm'),
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));

describe('TokenIdentityItem volume line', () => {
  test('runs a volume on its own at the 12px subtitle size', () => {
    render(
      <TokenIdentityItem symbol="SP500" address="" showVolume volume={249} />,
    );

    expect(screen.getByTestId('volume-number').getAttribute('data-size')).toBe(
      '$bodySm',
    );
  });

  test('matches the localized name size when the volume sits beside it', () => {
    render(
      <TokenIdentityItem
        symbol="NVDA"
        address=""
        showVolume
        volume={66_720_000}
        perpsSubtitle="NVIDIA"
      />,
    );

    expect(screen.getByText('NVIDIA')).toBeTruthy();
    expect(screen.getByTestId('volume-number').getAttribute('data-size')).toBe(
      '$bodySm',
    );
  });

  test('shows a stock listing company name beside the volume', () => {
    render(
      <TokenIdentityItem
        symbol="AAPL"
        address=""
        showVolume
        volume={12_890_000_000}
        stockListingName="Apple"
      />,
    );

    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByTestId('volume-number').getAttribute('data-size')).toBe(
      '$bodySm',
    );
  });

  test('prefers the tokenized stock subtitle over a listing name', () => {
    render(
      <TokenIdentityItem
        symbol="AAPLon"
        address=""
        showVolume
        volume={1}
        stock={{
          subtitle: 'Apple (Ondo)',
          source: 'ondo',
          sourceLogoUri: '',
          title: 'Ondo',
          isOpen: true,
        }}
        stockListingName="Apple"
      />,
    );

    expect(screen.getByText('Apple (Ondo)')).toBeTruthy();
    expect(screen.queryByText('Apple')).toBeNull();
  });

  test('leaves the volume out until it loads, with no placeholder', () => {
    render(
      <TokenIdentityItem symbol="AAPL" address="" showVolume volume={NaN} />,
    );

    expect(screen.queryByTestId('volume-number')).toBeNull();
    expect(screen.queryByText('--')).toBeNull();
  });
});
