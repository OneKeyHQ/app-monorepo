/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpDexBadge, SubtitleText } from './PerpsBadges';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

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
  LazyPopover: ({
    renderTrigger,
    renderContent,
  }: {
    renderTrigger: ReactNode;
    renderContent: ReactNode;
  }) => (
    <details data-testid="badge-description">
      <summary onClick={(event) => event.stopPropagation()}>
        {renderTrigger}
      </summary>
      {renderContent}
    </details>
  ),
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

describe('PerpDexBadge interaction', () => {
  afterEach(() => {
    platformEnv.isNative = false;
  });

  test.each([true, false])(
    'lets a display-only badge tap reach the token selector (native=%s)',
    (isNative) => {
      platformEnv.isNative = isNative;
      const openTokenSelector = jest.fn();

      render(
        <button type="button" onClick={openTokenSelector}>
          <PerpDexBadge dexLabel="xyz" interactive={false} />
        </button>,
      );

      fireEvent.click(screen.getByText('xyz'));

      expect(openTokenSelector).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('badge-description')).toBeNull();
      expect(screen.queryByTestId('subtitle-tooltip')).toBeNull();
    },
  );

  test('preserves the native description trigger at other entry points', () => {
    platformEnv.isNative = true;
    const onParentPress = jest.fn();

    render(
      <button type="button" onClick={onParentPress}>
        <PerpDexBadge dexLabel="xyz" />
      </button>,
    );

    fireEvent.click(screen.getByText('xyz'));

    expect(screen.getByTestId('badge-description')).toBeTruthy();
    expect(onParentPress).not.toHaveBeenCalled();
  });

  test('preserves the web tooltip at other entry points', () => {
    render(<PerpDexBadge dexLabel="xyz" />);

    expect(screen.getByTestId('subtitle-tooltip')).toBeTruthy();
  });
});
