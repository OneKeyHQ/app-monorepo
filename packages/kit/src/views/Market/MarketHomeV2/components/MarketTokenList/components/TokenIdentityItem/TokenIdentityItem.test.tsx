/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TokenIdentityItem } from './TokenIdentityItem';

const mockCopyText = jest.fn();
let mockGtMd = false;

// Jest maps every `@onekeyhq/components` path, subpaths included, to one mock
// module, so the lazy overlays must live in this single factory.
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  IconButton: ({
    onPress,
    accessibilityLabel,
  }: {
    onPress: (event: { stopPropagation: () => void }) => void;
    accessibilityLabel: string;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress} />
  ),
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
  Stack: ({
    children,
    onPress,
  }: PropsWithChildren<{
    onPress?: (event: { stopPropagation: () => void }) => void;
  }>) =>
    onPress ? (
      <button type="button" aria-label="Copy address" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    ),
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useClipboard: () => ({ copyText: mockCopyText }),
  useMedia: () => ({ gtMd: mockGtMd }),
  LazyTooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => (
    <>{renderTrigger}</>
  ),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Copy address' }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isJest: true },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { dex: { actions: { dexCopyCA: jest.fn() } } },
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

afterEach(() => {
  mockGtMd = false;
  mockCopyText.mockClear();
  jest.restoreAllMocks();
});

describe('TokenIdentityItem volume line', () => {
  test.each(['', '0x1234567890123456789012345678901234567890'])(
    'shows a native stock name once with address %p',
    (address) => {
      jest.replaceProperty(platformEnv, 'isNative', true);
      mockGtMd = true;
      render(
        <TokenIdentityItem
          symbol="AAPL"
          name=" Apple Inc. "
          stockListingName="Apple Inc."
          address={address}
          showCopyButton
        />,
      );

      expect(screen.getAllByText('Apple Inc.')).toHaveLength(1);
      if (address) {
        expect(screen.getByText('0x1234...7890')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
        expect(mockCopyText).toHaveBeenCalledWith(address);
      } else {
        expect(
          screen.queryByRole('button', { name: 'Copy address' }),
        ).toBeNull();
      }
    },
  );

  test('shows the name with a reachable address and copy action on native tables', () => {
    jest.replaceProperty(platformEnv, 'isNative', true);
    mockGtMd = true;
    const address = '0x1234567890123456789012345678901234567890';
    const onCopied = jest.fn();
    render(
      <TokenIdentityItem
        symbol="MEME"
        name="A Meme Coin"
        address={address}
        showCopyButton
        onCopied={onCopied}
      />,
    );

    expect(screen.getByText('A Meme Coin')).toBeTruthy();
    expect(screen.getByText('0x1234...7890')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    expect(mockCopyText).toHaveBeenCalledWith(address);
    expect(onCopied).toHaveBeenCalledWith(address);
  });

  test.each([false, true])(
    'retains the stock subtitle and address on native=%p',
    (isNative) => {
      jest.replaceProperty(platformEnv, 'isNative', isNative);
      mockGtMd = true;
      render(
        <TokenIdentityItem
          symbol="AAPLon"
          name="Apple Ondo Token"
          address="0x1234567890123456789012345678901234567890"
          showCopyButton
          stock={{
            subtitle: '苹果',
            source: 'ondo',
            sourceLogoUri: '',
            title: 'Ondo',
          }}
        />,
      );

      expect(screen.getByText('Apple Ondo Token')).toBeTruthy();
      expect(screen.getByText('苹果')).toBeTruthy();
      expect(screen.getByText('0x1234...7890')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copy address' })).toBeTruthy();
    },
  );

  test.each([false, true])(
    'shows an addressless listing name on native=%p',
    (isNative) => {
      jest.replaceProperty(platformEnv, 'isNative', isNative);
      render(<TokenIdentityItem symbol="TSM" name="台积电" address="" />);

      expect(screen.getByText('台积电')).toBeTruthy();
    },
  );

  test('retains the contract address alongside the resting token name', () => {
    render(
      <TokenIdentityItem
        symbol="MEME"
        name="A Meme Coin"
        address="0x1234567890123456789012345678901234567890"
        showCopyButton
      />,
    );

    expect(screen.getByText('A Meme Coin')).toBeTruthy();
    expect(screen.getByText('0x1234...7890')).toBeTruthy();
  });

  test.each([false, true])(
    'keeps the volume layout on native=%p when a name is supplied',
    (isNative) => {
      jest.replaceProperty(platformEnv, 'isNative', isNative);
      render(
        <TokenIdentityItem
          symbol="MEME"
          name="A Meme Coin"
          address=""
          showVolume
          volume={249}
        />,
      );

      expect(screen.queryByText('A Meme Coin')).toBeNull();
      expect(screen.getByTestId('volume-number').textContent).toBe('249');
    },
  );

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
