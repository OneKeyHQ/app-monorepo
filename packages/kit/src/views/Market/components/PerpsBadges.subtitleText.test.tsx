/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { SubtitleText } from './PerpsBadges';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// Jest maps every `@onekeyhq/components` path, subpaths included, to one mock
// module, so the lazy overlays must live in this single factory.
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  Image: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useMedia: () => ({ gtMd: true }),
  LazyTooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => (
    <div data-testid="subtitle-tooltip">{renderTrigger}</div>
  ),
  LazyPopover: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/TradingHoursPanel', () => ({
  TradingHoursTrigger: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({ formatDate: () => '' }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useUSMarketStatus', () => ({
  useUSMarketStatus: () => undefined,
}));

describe('SubtitleText', () => {
  test('shows an uncapped list-row name without a hover tooltip', () => {
    render(<SubtitleText subtitle="Circle" />);

    expect(screen.getByText('Circle')).toBeTruthy();
    expect(screen.queryByTestId('subtitle-tooltip')).toBeNull();
  });

  test('keeps the full-name tooltip for a capped selector name', () => {
    render(<SubtitleText subtitle="Circle Internet Group" maxWidth={66} />);

    expect(screen.getByTestId('subtitle-tooltip')).toBeTruthy();
  });
});
